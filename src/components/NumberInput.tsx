import { classNames } from "@/utils/classNames"
import { withPrefix } from "@/utils/test-utils"
import { useEffect, useRef, useState } from "react"

export const decimalSeparators = [",", "."]

export enum InputValidationState {
  Valid = "Valid",
  Warning = "Warning",
  Error = "Error",
}

const getBorderStyles = (disabled?: boolean) => (validationState?: InputValidationState) => {
  if (disabled) return "border border-backgrounds-400"
  switch (validationState) {
    case InputValidationState.Error:
      return "border border-functional-error-500"
    case InputValidationState.Warning:
      return "border border-functional-warning-500"
    default:
      return "border hover:border-functional-buy-500 focus-within:border-functional-buy-500"
  }
}

const getFontColorStyles = (disabled?: boolean) => (validationState?: InputValidationState) => {
  if (disabled) return "text-fontColor-500"
  switch (validationState) {
    case InputValidationState.Error:
      return "text-functional-error-500"
    case InputValidationState.Warning:
      return "text-functional-warning-500"
    default:
      return "text-fontColor-0"
  }
}

export type NumberInputProps = Omit<
  React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
  "inputMode" | "type" | "prefix"
> & {
  suffix?: React.ReactNode
  prefix?: React.ReactNode
  testIdPrefix?: string
  label?: React.ReactNode
  htmlFor: string
  disabled?: boolean
  validationState?: InputValidationState
}

export const NumberInput: React.FC<NumberInputProps> = ({
  label,
  htmlFor,
  prefix,
  suffix,
  value,
  validationState,
  disabled,
  onChange,
  testIdPrefix,
  className,
  ...inputProps
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [suffixWidth, setSuffixWidth] = useState(0)
  const [inputValue, setInputValue] = useState(value)
  const isValid = validationState === InputValidationState.Valid

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    if (!onChange) return
    const str = event.target.value.trim()

    if (decimalSeparators.includes(str)) {
      setInputValue(str)
      return
    }

    if (isNaN(Number(str.replace(",", ".")))) return

    setInputValue(str)
    onChange(event)
  }

  useEffect(() => {
    if (Number(value) !== Number(inputValue)) setInputValue(String(value))
  }, [value])

  const prefixNode = prefix && (
    <span
      className={classNames(
        "h-full text-fontColor-500 flex text-sm font-normal font-primary items-center",
        !disabled ? "group-hover:text-fontColor-0 group-focus-within:text-fontColor-0" : "",
      )}
    >
      {prefix}
    </span>
  )

  const suffixNode = suffix && (
    <span
      ref={(el) => el && !suffixWidth && setSuffixWidth(Math.ceil(el.getBoundingClientRect().width))}
      className={classNames(
        "absolute right-0 top-0 h-full text-fontColor-500 flex font-normal font-primary items-center mr-4",
        !disabled ? "group-hover:text-fontColor-0 group-focus-within:text-fontColor-0" : "",
      )}
    >
      {suffix}
    </span>
  )

  const borderStyles = getBorderStyles(disabled)(validationState)
  const fontColor = getFontColorStyles(disabled)(validationState)

  return (
    <div
      onClick={() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }}
      className={classNames(
        `group cursor-text relative inline-flex font-secondary hover:[] text-sm font-normal bg-backgrounds-200 w-full max-w-[350px] py-2 rounded-lg`,
        borderStyles,
        className,
      )}
    >
      <div className="flex flex-col gap-1 justify-center px-4">
        <div className="flex gap-1">
          {prefixNode}
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={inputValue}
            disabled={disabled}
            onChange={handleChange}
            className={classNames("caret-functional-buy-500 w-full outline-none bg-transparent", fontColor)}
            style={{ paddingRight: suffixWidth + "px" }}
            {...inputProps}
            data-testid={withPrefix("number-input", testIdPrefix)}
          />
        </div>
        {label && (
          <label
            data-testid={withPrefix("number-input-label", testIdPrefix)}
            htmlFor={htmlFor}
            className={classNames(
              "block text-fontColor-500 text-[0.7rem] font-medium",
              isValid || !validationState ? "group-focus-within:text-functional-buy-500 group-hover:text-functional-buy-500" : fontColor,
            )}
          >
            {label}
          </label>
        )}
      </div>
      {suffixNode}
    </div>
  )
}
