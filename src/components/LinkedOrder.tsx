import { Asset } from "@/api/graphql/instruments"
import { OrderType } from "@/api/graphql/queries"
import { CurrencyInput } from "@/components/CurrencyInput"
import { roundToTwo } from "@/utils/rounding"
import { Switch as RawSwitch } from "@headlessui/react"
// import { Collapsable } from "./Collapsable"
import { IconType, NotificationIcon } from "./NotificationIcon"
import { InputValidationState } from "./NumberInput"

const Switch = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => {
  const className1 = (bool: boolean) =>
    `${bool ? "bg-accents-500" : "bg-backgrounds-400"} relative inline-flex h-4 w-8 items-center rounded-full`

  const className2 = (bool: boolean) =>
    `${bool ? "translate-x-4" : "translate-x-0"} inline-block h-4 w-4 transform rounded-full bg-white transition`

  return (
    <RawSwitch checked={checked} onChange={onChange} className={className1(checked)}>
      <span className={className2(checked)} />
    </RawSwitch>
  )
}

interface Props {
  orderType: OrderType
  title: string
  subTitle: string
  checked: boolean
  onToggle: (activated: boolean) => void
  asset: Asset
  value: bigint | null
  onChange: (value: bigint | null) => void
  inputLabel?: React.ReactNode
  labelBelow?: React.ReactNode
  initialValue?: bigint | null
  percentage: number
  validationState: InputValidationState
  setIsBlurred: (isBlurred: boolean) => void
}

export const LinkedOrderInput: React.FC<Props> = ({
  orderType,
  setIsBlurred,
  validationState,
  percentage,
  title,
  subTitle,
  onChange,
  initialValue = null,
  labelBelow,
  checked,
  onToggle,
  asset,
  value,
  inputLabel,
}) => {
  const isRemovingOrder = initialValue !== null && !checked
  const isTakeProfit = orderType === OrderType.TakeProfit

  const subText = isRemovingOrder ? (
    <span className="text-functional-warning-500 text-xs">{`You are removing your ${
      isTakeProfit ? "take profit" : "stop loss"
    } order`}</span>
  ) : !checked ? (
    <span className="text-fontColor-400 text-xs">{subTitle}</span>
  ) : null

  return (
    <div className="flex flex-col gap-1 bg-backgrounds-200 rounded-2xl py-2 px-2">
      <div className="flex flex-col px-2 mb-1 gap-1">
        <div className="flex gap-1">
          {isRemovingOrder ? <NotificationIcon iconType={IconType.Warning2} /> : null}
          <div className="flex justify-between w-full">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{title}</span>
              {subText}
            </div>
            <Switch checked={checked} onChange={onToggle} />
          </div>
        </div>
      </div>
      {checked ? (
        <>
          <CurrencyInput
            placeholder="0.00"
            className="border-[#484a58]"
            htmlFor="linked-order-input"
            value={value}
            onChange={onChange}
            currency={`${roundToTwo(percentage)}%`}
            validationState={validationState}
            onBlur={() => setIsBlurred(true)}
            onFocus={() => setIsBlurred(false)}
            // currency={asset.symbol}
            label={inputLabel}
            {...asset}
          />
          {labelBelow}
        </>
      ) : null}
    </div>
  )
}

export const AboutLinkedOrders = () => {
  return (
    // <Collapsable testId="none" label="About linked orders">
      <div className="flex flex-col gap-1 bg-backgrounds-100 rounded-2xl p-4">
        <div className="flex">
          <NotificationIcon iconType={IconType.Warning2} />
        </div>
      </div>
    // </Collapsable>
  )
}
