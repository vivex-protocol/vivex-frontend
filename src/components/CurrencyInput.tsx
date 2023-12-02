import { useCurrencyInput } from "@/hooks/useCurrencyInput"
import { classNames } from "@/utils/classNames"
import { NumberInput, NumberInputProps } from "./NumberInput"

type NumberInputWithIconProps = Omit<NumberInputProps, "suffix" | "onChange" | "value"> & {
  value: bigint | null
  currency: string
  decimals: number
  displayDecimals: number
  className?: string
  onChange?: (value: bigint | null) => void
}

export const CurrencyInput: React.FC<NumberInputWithIconProps> = ({
  value: valueBigint,
  onChange: onChangeBigint,
  currency,
  decimals,
  displayDecimals,
  className,
  ...props
}) => {
  const [value, onChange] = useCurrencyInput(valueBigint, decimals, onChangeBigint)

  return <NumberInput className={classNames("text-base", className)} value={value} onChange={onChange} suffix={currency} {...props} />
}
