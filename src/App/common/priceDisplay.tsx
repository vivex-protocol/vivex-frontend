import { toDisplayValue } from "@/components/CurrencyDisplay"
import { Loading } from "@/components/Loading"
import { Tooltip } from "@/components/Tooltip"
import { TooltipKey, tooltipMapper } from "@/components/tooltipContent"
import { classNames } from "@/utils/classNames"
import { SUSPENSE } from "@react-rxjs/core"
import { QuoteSwapMapped } from "."

export const labelJsx = (label: string, tooltipKey: TooltipKey) => (
  <span className="flex flex-row gap-1">
    <Tooltip testId={`${label}-${tooltipKey}`} className="self-center text-fontColor-500" message={tooltipMapper(tooltipKey)}>
      {label}
    </Tooltip>
  </span>
)

const routedThrough = (name: string | null, logoURI?: string) => (
  <span className={classNames("text-xs", name === null ? "hidden" : "")}>
    <span className="text-fontColor-500">{"Routed through: "}</span>
    <span className={classNames(name === "loading" ? "blur-sm" : "")}>{name === "loading" ? "Paraswap" : name && name}</span>
  </span>
)

export const spotPriceJsx = (data: QuoteSwapMapped | SUSPENSE, quantity: bigint | null) => {
  // if (quantity === null) return null
  if (quantity === null)
    return (
      <div className="flex justify-between">
        <div className="flex flex-col">
          {labelJsx("Entry Price", "spotPrice")}
          {routedThrough(null)}
        </div>
        <span>-</span>
      </div>
    )
  if (data === SUSPENSE)
    return (
      <div className="flex justify-between">
        <div className="flex flex-col">
          {labelJsx("Entry Price", "spotPrice")}
          {routedThrough("loading")}
        </div>
        <Loading size={20} />
      </div>
    )
  const { quote, trades } = data
  const [trade] = trades
  return (
    <div className="flex justify-between">
      <div className="flex flex-col">
        {labelJsx(quote.tradeQuantity < 0n ? "Exit Price" : "Entry Price", "spotPrice")}
        {routedThrough(trade.source.name)}
      </div>
      {toDisplayValue(trade.price, quote.pair.quote) || "-"}
    </div>
  )
}
