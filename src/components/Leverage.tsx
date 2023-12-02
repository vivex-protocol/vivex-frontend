import { classNames } from "@/utils/classNames"
import { roundToTwo } from "@/utils/rounding"
import { withPrefix } from "@/utils/test-utils"
import { useEffect } from "react"

export const LeverageValue: React.FC<{
  testIdPrefix: string
  leverage: number
}> = ({ testIdPrefix, leverage }) => (
  <div className="text-yellow-400 px-1 rounded-sm bg-[#36321D]">{`${roundToTwo(leverage)}x`}</div>
  // <span data-testid={withPrefix("leverage", testIdPrefix)}>
  //   {roundToTwo(leverage)}x
  // </span>
)

export const Leverage: React.FC<{
  testIdPrefix: string
  leverage: number
  maxLeverage?: number
  showSuffix?: boolean
}> = ({ testIdPrefix, leverage, maxLeverage, showSuffix = true }) => {
  return (
    <div className="font-secondary">
      <div className="mr-1">
        <LeverageValue testIdPrefix={testIdPrefix} leverage={leverage} />
      </div>
      {showSuffix && maxLeverage ? (
        <span data-testid={withPrefix("leverageMax", testIdPrefix)} className="text-fontColor-400 text-xs">
          {`(max: ${roundToTwo(maxLeverage)}x)`}
        </span>
      ) : null}
    </div>
  )
}

interface SliderProps {
  min: number
  max: number
  value: number | null
  onChange: (leverage: number) => void
  lowerBound: number
  upperBound: number
  testIdPrefix: string
  disabled?: boolean
}

export const LeverageEdit: React.FC<SliderProps> = ({ value, ...props }) => {
  return (
    <div className="flex flex-col gap-2 w-full px-2">
      <div className="flex flex-row justify-between text-sm">
        <span className="text-fontColor-500">Leverage</span>
        <span className={classNames("text-base h-6", value ? "" : "hidden")} data-testid={withPrefix("leverage-value", props.testIdPrefix)}>
          {value ? `${roundToTwo(value)}x` : null}
        </span>
      </div>
      <LeverageSlider value={value} {...props} />
    </div>
  )
}

const LeverageSlider: React.FC<SliderProps> = ({ min, max, value, onChange, lowerBound, upperBound, testIdPrefix, disabled }) => {
  useEffect(() => {
    if (value && !disabled && value > upperBound) onChange(upperBound)
    else if (value && value < lowerBound) onChange(lowerBound)
  }, [upperBound, lowerBound])

  const upper = disabled ? max : Math.min(upperBound, max)
  const enabledWidth = `calc(${((upper - min) / (max - min)) * 100}%)`

  return (
    <div
      className="border-box mb-4 relative w-full"
      style={{
        width: "100%",
      }}
    >
      <div className="top-0 h-1 border-box relative my-2 rounded-full bg-backgrounds-400">
        <div
          className={classNames(
            "top-0 rounded bg-blue-1 h-1 border-box relative my-2 rounded-l-full",
            upper === max && "rounded-r-full",
          )}
          style={{ width: enabledWidth }}
        >
          {lowerBound ? (
            <div
              className="top-0 bg-backgrounds-400 h-1 border-box border border-backgrounds-400 relative my-2 rounded-l-full"
              style={{
                width: `calc(${(100 * (lowerBound - min)) / (max - min) + "%"})`,
              }}
            />
          ) : null}
        </div>
      </div>

      <input
        type="range"
        data-testid={`${testIdPrefix}--leverage-slider`}
        className={classNames(
          "absolute z-0 top-2 w-full border-box slider h-1 appearance-none rounded-full cursor-pointer",
          disabled ? "bg-backgrounds-400" : "bg-transparent",
        )}
        disabled={disabled}
        min={min}
        max={max}
        step={0.05}
        value={value || 0}
        onChange={(event) => {
          const value = Number(event.target.value)
          if (disabled || isNaN(value)) return
          else if (upperBound && value > upperBound) onChange(upperBound)
          else if (lowerBound && value < lowerBound) onChange(lowerBound)
          else onChange(value)
        }}
      />
      <Markers min={min} max={max} testIdPrefix={testIdPrefix} onChange={onChange} lowerBound={lowerBound} upperBound={upperBound} />
    </div>
  )
}

const Markers: React.FC<{
  min: number
  max: number
  testIdPrefix: string
  onChange: (leverage: number) => void
  lowerBound?: number
  upperBound?: number
}> = ({ min, max, testIdPrefix, onChange, lowerBound, upperBound }) => {
  const diff = max - min
  let stepSize
  if (diff <= 3.25) stepSize = 0.5
  else if (diff < 9) stepSize = 1
  else if (diff < 18) stepSize = 2
  else stepSize = 13

  const markers = [min]

  let next = min + stepSize

  while (next <= max) {
    markers.push(next)
    next += stepSize
  }

  return (
    <div
      className="relative px-4 mx-2"
      style={{
        top: "-10px",
      }}
    >
      {markers.map((val) => (
        <Option
          value={val}
          min={min}
          max={max}
          key={val}
          testIdPrefix={testIdPrefix}
          onChange={onChange}
          disabled={(!!lowerBound && val < lowerBound) || (!!upperBound && val > upperBound)}
        />
      ))}
    </div>
  )
}

const Option: React.FC<{
  value: number
  min: number
  max: number
  testIdPrefix: string
  onChange: (leverage: number) => void
  disabled: boolean
}> = ({ value, min, max, testIdPrefix, onChange, disabled }) => {
  const pos = (100 * (value - min)) / (max - min) + "%"
  return (
    <div
      data-testid={`${testIdPrefix}--leverage-slider-marker`}
      className="flex flex-col items-center text-xs absolute -translate-x-1/2 mt-4 -top-3 z-1"
      style={{
        left: pos,
      }}
    >
      <button
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onChange(value)
        }}
        className={classNames(
          "mt-2 text-fontColor-400 font-primary py-1 px-2 rounded-full flex flex-col justify-center items-center",
          disabled ? "text-backgrounds-400" : "hover:bg-backgrounds-300 hover:text-fontColor-200",
        )}
      >
        {value}x
      </button>
    </div>
  )
}
