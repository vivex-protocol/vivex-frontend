import { OrderType } from "@/api/graphql/queries"
import { Checkbox } from "@/components/Checkbox"
import { IconType, NotificationIcon } from "@/components/NotificationIcon"
import { ILinkedOrder } from "@/hooks/useTrade"
import { CashflowCurrency, Side, mulDiv } from "@/vivex-xyz/sdk"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { combineLatest, map } from "rxjs"
import { estimatePnl } from "../common"
import { LinkedOrder } from "../common/LinkedOrder"
import { nsPriceQuote$, resetable } from "./state"

const createResetSignalState = <T extends any>(initial: T) => {
  const [signal$, setSignal] = createSignal<T>()
  const state$ = state(resetable(signal$, initial), initial)
  return [state$, setSignal] as const
}

const deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10 // 10 years
const tolerance = BigInt(0.2e4)

const [stopLossChecked$, setStopLossChecked] = createResetSignalState(false)
const [stopLossInput$, setStopLossInput] = createResetSignalState<bigint | null>(null)
const [takeProfitChecked$, setTakeProfitChecked] = createResetSignalState(false)
const [takeProfitInput$, setTakeProfitInput] = createResetSignalState<bigint | null>(null)

const [linkedOrdersOpen$, setLinkedOrdersOpen] = createResetSignalState(false)

export const linkedOrders$ = state(
  combineLatest([stopLossInput$, takeProfitInput$, nsPriceQuote$]).pipe(
    map(([sl, tp, { side, pair }]) => {
      const isShort = side === Side.Short
      const baseUnit = 10n ** BigInt(pair.base.decimals)
      const quoteUnit = 10n ** BigInt(pair.quote.decimals)
      const orders: ILinkedOrder[] = []
      if (sl) {
        orders.push({
          orderType: OrderType.StopLoss,
          // @ts-ignore
          limitPrice: isShort ? mulDiv(baseUnit, quoteUnit, sl) : sl,
          cashflowCcy: isShort ? CashflowCurrency.Base : CashflowCurrency.Quote,
          deadline,
          tolerance,
        })
      }
      if (tp) {
        orders.push({
          orderType: OrderType.TakeProfit,
          // @ts-ignore
          limitPrice: isShort ? mulDiv(baseUnit, quoteUnit, tp) : tp,
          // @ts-ignore
          cashflowCcy: isShort ? CashflowCurrency.Base : CashflowCurrency.Quote,
          deadline,
          tolerance,
        })
      }
      return orders
    }),
  ),
  [] as ILinkedOrder[],
)

const slEstimatedLoss$ = state(
  combineLatest([stopLossInput$, nsPriceQuote$]).pipe(
    map(([input, { markPrice, side, quantity, pair }]) => {
      const sQuantity = side === Side.Short ? -quantity : quantity
      return estimatePnl(sQuantity, input, markPrice, pair.base, markPrice, OrderType.StopLoss)
    }),
  ),
)

const tpEstimatedProfit$ = state(
  combineLatest([takeProfitInput$, nsPriceQuote$]).pipe(
    map(([input, { markPrice, side, quantity, pair }]) => {
      const sQuantity = side === Side.Short ? -quantity : quantity
      return estimatePnl(sQuantity, input, markPrice, pair.base, markPrice, OrderType.TakeProfit)
    }),
  ),
)

const hasInputs$ = state(combineLatest([stopLossInput$, takeProfitInput$]).pipe(map(([sl, tp]) => sl !== null || tp !== null)), false)

export const LinkedOrders = () => {
  const { resultingPosition, pair, side } = useStateObservable(nsPriceQuote$)
  const isOpen = useStateObservable(linkedOrdersOpen$)
  const hasInputs = useStateObservable(hasInputs$)
  const slChecked = useStateObservable(stopLossChecked$)
  const slValue = useStateObservable(stopLossInput$)
  const slEst = useStateObservable(slEstimatedLoss$)

  const tpChecked = useStateObservable(takeProfitChecked$)
  const tpValue = useStateObservable(takeProfitInput$)
  const tpEst = useStateObservable(tpEstimatedProfit$)

  const onToggle = (checked: boolean) => {
    setLinkedOrdersOpen(checked)
    if (!checked) {
      setStopLossInput(null)
      setTakeProfitInput(null)
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1 text-sm pl-2 items-center">
        <span>Take Profit / Stop Loss</span>
        <Checkbox checked={isOpen} onChange={onToggle} />
      </div>
      {isOpen ? (
        <div className="bg-backgrounds-200 rounded-2xl flex flex-col">
          <LinkedOrder
            quoteAsset={pair.quote}
            setToggleChecked={setTakeProfitChecked}
            isChecked={tpChecked}
            inputValue={tpValue}
            setInput={setTakeProfitInput}
            // @ts-ignore
            estPnl={tpEst}
            orderType={OrderType.TakeProfit}
            liquidationPrice={resultingPosition.liquidationPrice}
            side={side}
          />
          <LinkedOrder
            quoteAsset={pair.quote}
            setToggleChecked={setStopLossChecked}
            isChecked={slChecked}
            inputValue={slValue}
            setInput={setStopLossInput}
            // @ts-ignore
            estPnl={slEst}
            orderType={OrderType.StopLoss}
            liquidationPrice={resultingPosition.liquidationPrice}
            side={side}
          />
          {hasInputs ? (
            <div className="flex py-2 px-4 gap-2 items-center">
              <NotificationIcon iconType={IconType.Warning2} />
              <span className="text-amber-400 text-xs">Order execution is not guaranteed</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
