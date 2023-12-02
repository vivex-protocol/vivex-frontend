import { estimatePnl } from "@/App/common"
import { LinkedOrder } from "@/App/common/LinkedOrder"
import { ConnectWalletBtn, SwitchChainBtn, btn } from "@/App/common/components"
import { labelJsx } from "@/App/common/priceDisplay"
import { SupportedChainIds } from "@/api/chain"
import { GraphPosition, OrderType } from "@/api/graphql/queries"
import { toDisplayValue } from "@/components/CurrencyDisplay"
import { IconType, NotificationIcon } from "@/components/NotificationIcon"
import { SecondaryButton } from "@/components/SecondaryButton"
import { ObservableType } from "@/utils/types"
import { CashflowCurrency, Side, getMaestroProxy, maestroABI, mulDiv } from "@/vivex-xyz/sdk"
import { sinkSuspense, state, useStateObservable } from "@react-rxjs/core"
import { createKeyedSignal, switchMapSuspended } from "@react-rxjs/utils"
import React, { Suspense, useEffect, useMemo, useState } from "react"
import { combineLatest, filter, map, startWith, switchMap, take, withLatestFrom } from "rxjs"
import { Hex, encodeFunctionData } from "viem"
import { useAccount, useContractWrite, useNetwork, usePrepareContractWrite } from "wagmi"
import { usePositionContext } from "../Position.context"
import { CtxPositionId, getLinkedOrders$, getPosition$, getPositionStatus$, unwrapId } from "../queries"
import { PositionHeaderNew } from "./PositionHeader"
import { EditType, onEditOrCancel, positionEditFlow$ } from "./state/base"

const [_input$, onInput] = createKeyedSignal(
  ({ id }) => id,
  (id: CtxPositionId, type: OrderType, value: bigint | null) => ({
    id,
    value,
    type,
  }),
)

const tpInput$ = state((id: CtxPositionId, type: OrderType) =>
  positionEditFlow$(id).pipe(
    switchMapSuspended(() =>
      getLinkedOrders$(id).pipe(
        take(1),
        switchMap(({ takeProfit, stopLoss }) =>
          _input$(id).pipe(
            filter((x) => x.type === type),
            map((x) => x.value),
            startWith((type === OrderType.TakeProfit ? takeProfit?.limitPrice : stopLoss?.limitPrice) || null),
          ),
        ),
      ),
    ),
    sinkSuspense(),
  ),
)

const tolerance = BigInt(0.2e4)
const deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10 // 10 years

type ExistingOrder = ObservableType<ReturnType<typeof getLinkedOrders$>>["takeProfit"]

const deriveBytes = (position: GraphPosition, existing: ExistingOrder, newLimitPrice: bigint | null, orderType: OrderType) => {
  const { positionId } = unwrapId(position.id)
  const { instrument } = position
  const isShort = instrument.side === Side.Short
  const cashflowCcy = isShort ? CashflowCurrency.Base : CashflowCurrency.Quote

  const bytes: Hex[] = []

  if (newLimitPrice && newLimitPrice !== existing?.limitPrice) {
    const limitPrice = isShort ? invertPrice(newLimitPrice, instrument) : newLimitPrice
    bytes.push(
      encodeFunctionData({
        abi: maestroABI,
        functionName: "placeLinkedOrder",
        args: [
          positionId,
          {
            orderType,
            cashflowCcy,
            tolerance,
            deadline,
            limitPrice,
          },
        ],
      }),
    )
  }

  if (existing) {
    const cancel = encodeFunctionData({
      abi: maestroABI,
      functionName: "cancel",
      args: [existing.orderId],
    })
    if (newLimitPrice !== existing.limitPrice) {
      bytes.push(cancel)
    }
  }

  return bytes
}

const transaction$ = state((id: CtxPositionId) =>
  getLinkedOrders$(id).pipe(
    switchMap(({ takeProfit, stopLoss }) =>
      combineLatest([tpInput$(id, OrderType.TakeProfit), tpInput$(id, OrderType.StopLoss)]).pipe(
        withLatestFrom(getPosition$(id)),
        map(([[tpPrice, slPrice], position]) => {
          return [
            // @ts-ignore
            deriveBytes(position, takeProfit, tpPrice, OrderType.TakeProfit),
            // @ts-ignore
            deriveBytes(position, stopLoss, slPrice, OrderType.StopLoss),
          ].flat(1) as readonly Hex[]
        }),
      ),
    ),
  ),
)

const invertPrice = (value: bigint, { quote, base }: GraphPosition["instrument"]) => mulDiv(base.unit, quote.unit, value)

const SubmitPlace: React.FC<{ maestroAddress: Hex }> = ({ maestroAddress }) => {
  const { id } = usePositionContext()
  const tx = useStateObservable(transaction$(id))
  const { address: account } = useAccount()

  const { config, error } = usePrepareContractWrite({
    address: maestroAddress,
    abi: maestroABI,
    functionName: "multicall",
    account,
    args: [tx],
  })

  const contract = useContractWrite(config)
  const { write, isSuccess, isLoading } = contract

  useEffect(() => {
    if (isSuccess) {
      onEditOrCancel(id, EditType.none)
    }
  })

  return btn(() => write?.(), `Submit`, !write || isLoading || tx.length === 0)
}

const SubmittingButton: React.FC = () => {
  const { id } = usePositionContext()
  const account = useAccount()
  const { chain } = useNetwork()
  const chainConnected = chain?.id as SupportedChainIds
  const { chainId } = unwrapId(id)
  const maestroAddress = useMemo(() => getMaestroProxy(chainId), [chainId])

  if (!account.isConnected) return <ConnectWalletBtn />
  if (chainConnected !== chainId) return <SwitchChainBtn chainId={chainId} />
  return (
    <Suspense fallback={btn(() => {}, `Submit`, true)}>
      <SubmitPlace maestroAddress={maestroAddress} />
    </Suspense>
  )
}

export const LinkedOrders: React.FC = () => {
  const { id, instrument, sQuantity, entryPrice } = usePositionContext()
  const { takeProfit, stopLoss } = useStateObservable(getLinkedOrders$(id))
  const { quote, base } = instrument
  const { markPrice, liquidationPrice } = useStateObservable(getPositionStatus$(id))

  const tpValue = useStateObservable(tpInput$(id, OrderType.TakeProfit))
  const [tpChecked, setTakeProfitChecked] = useState(Boolean(takeProfit))

  const slValue = useStateObservable(tpInput$(id, OrderType.StopLoss))
  const [slChecked, setStopLossChecked] = useState(Boolean(stopLoss))

  return (
    <Suspense fallback={null}>
      <div className="bg-backgrounds-100 rounded-xl inline-block w-full">
        <div className="font-primary rounded-lg m-4 max-w-[350px] flex flex-col gap-3">
          <PositionHeaderNew />
          <LinkedOrder
          // @ts-ignore
            initialValue={takeProfit?.limitPrice}
            orderType={OrderType.TakeProfit}
            quoteAsset={quote}
            // @ts-ignore
            inputValue={tpValue}
            setToggleChecked={setTakeProfitChecked}
            isChecked={tpChecked}
            setInput={(val) => {
              onInput(id, OrderType.TakeProfit, val)
            }}
            // @ts-ignore
            estPnl={estimatePnl(sQuantity, tpValue, markPrice, base, entryPrice, OrderType.TakeProfit)}
            // @ts-ignore
            liquidationPrice={liquidationPrice}
            // @ts-ignore
            side={instrument.side}
          />
          <LinkedOrder
          // @ts-ignore
            initialValue={stopLoss?.limitPrice}
            orderType={OrderType.StopLoss}
            quoteAsset={quote}
            // @ts-ignore
            inputValue={slValue}
            setToggleChecked={setStopLossChecked}
            isChecked={slChecked}
            setInput={(val) => {
              onInput(id, OrderType.StopLoss, val)
            }}
            // @ts-ignore
            estPnl={estimatePnl(sQuantity, slValue, markPrice, base, entryPrice, OrderType.StopLoss)}
            // @ts-ignore
            liquidationPrice={liquidationPrice}
            // @ts-ignore
            side={instrument.side}
          />
          <div className="flex flex-col gap-2 mb-4 text-sm px-2">
            <div className="flex justify-between items-center">
              {labelJsx("Mark Price", "markPrice")}
              {toDisplayValue(markPrice, quote)}
            </div>
            <div className="flex justify-between items-center">
              {labelJsx("Entry Price", "entryPrice")}
              {toDisplayValue(entryPrice, quote)}
            </div>
            <div className="flex justify-between items-center">
              {labelJsx("Positions Liq. Price", "liquidationPrice")}
              {toDisplayValue(liquidationPrice, quote)}
            </div>
          </div>
          {true ? (
            <div className="flex px-4 gap-2 items-center">
              <NotificationIcon iconType={IconType.Warning2} />
              <span className="text-amber-400 text-xs">Order execution is not guaranteed</span>
            </div>
          ) : null}
        </div>
        <div className="m-4 gap-2 flex flex-row">
          <SecondaryButton
            className="w-full"
            testId="position-edit--cancel-button"
            onClick={() => {
              onEditOrCancel(id, EditType.none)
            }}
          >
            Cancel
          </SecondaryButton>
          <SubmittingButton />
        </div>
      </div>
    </Suspense>
  )
}
