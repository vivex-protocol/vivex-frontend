import { Asset } from "@/api/graphql/instruments"
import { OrderType } from "@/api/graphql/queries"
import { toDisplayValue } from "@/components/CurrencyDisplay"
import { LinkedOrderInput } from "@/components/LinkedOrder"
import { IconType, NotificationIcon } from "@/components/NotificationIcon"
import { InputValidationState } from "@/components/NumberInput"
import { getPnlColor } from "@/components/PnL"
import { Side } from "@/utils/custom"
import { useState } from "react"

const SLsubtitle = "Add a stop loss to manage your risk"
const TPsubtitle = "Add a take profit to automatically realise profits"

interface LinkedOrderProps {
  initialValue?: bigint
  quoteAsset: Asset
  setToggleChecked: (checked: boolean) => void
  isChecked: boolean
  inputValue: bigint | null
  setInput: (val: bigint | null) => void
  estPnl: { abs: bigint; percentage: number; crosses?: string }
  orderType: OrderType
  liquidationPrice: bigint
  side: Side
}

const liqPriceWarning = (side: Side) =>
  `Trigger price is ${side === Side.Long ? "below" : "above"} liquidation price. Order will not execute in current condition`
const crossPriceWarning = (str?: string) => ` Trigger price is ${str} current mark price. Order will execute immediately!`
export const LinkedOrder: React.FC<LinkedOrderProps> = ({
  initialValue,
  orderType,
  quoteAsset,
  isChecked,
  setToggleChecked,
  inputValue,
  setInput,
  estPnl: { abs: estPnl, percentage, crosses },
  liquidationPrice,
  side,
}) => {
  const [isBlurred, setIsBlurred] = useState(true)
  const isTakeProfit = orderType === OrderType.TakeProfit
  const onToggle = (checked: boolean) => {
    setToggleChecked?.(checked)
    if (!checked) {
      setInput(null)
    } else if (initialValue) {
      setInput(initialValue)
    }
  }

  const stopLossOutOfRange =
    !isTakeProfit && inputValue && (side === Side.Short ? inputValue > liquidationPrice : inputValue < liquidationPrice)
  const crossesSpread = Boolean(crosses)

  const validationState = (crossesSpread || stopLossOutOfRange) && isBlurred ? InputValidationState.Warning : InputValidationState.Valid

  const labelBelow =
    validationState === InputValidationState.Valid ? (
      <div className="text-center text-neutral-400 text-xs font-normal font-['Plus Jakarta Sans'] leading-none">
        <span>{`Estimated ${isTakeProfit ? "Profit" : "Loss"}:`}</span>
        <span className={getPnlColor(estPnl)}>{`${toDisplayValue(estPnl, quoteAsset, { showZero: true, formatAsDelta: true })} ${
          quoteAsset.symbol
        }`}</span>
      </div>
    ) : (
      <div className="flex gap-1">
        <NotificationIcon iconType={IconType.Warning2} />
        <span className="text-xs">{stopLossOutOfRange ? liqPriceWarning(side) : crossPriceWarning(crosses)}</span>
      </div>
    )

  return (
    <LinkedOrderInput
      initialValue={initialValue}
      orderType={orderType}
      setIsBlurred={setIsBlurred}
      validationState={validationState}
      percentage={percentage}
      labelBelow={labelBelow}
      subTitle={isTakeProfit ? TPsubtitle : SLsubtitle}
      checked={isChecked}
      onChange={setInput}
      inputLabel="Trigger price"
      title={isTakeProfit ? "Take Profit" : "Stop Loss"}
      onToggle={onToggle}
      value={inputValue}
      asset={quoteAsset}
    />
  )
}
