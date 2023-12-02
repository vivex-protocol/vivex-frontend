import { maxQuantityWarning, minQuantityWarning } from "@/App/common/components"
import { toDisplayValue } from "@/components/CurrencyDisplay"
import { CurrencyInput } from "@/components/CurrencyInput"
import { BuySellTabButton } from "@/components/Tabs"
import { absolute } from "@/vivex-xyz/sdk"
import { state, useStateObservable } from "@react-rxjs/core"
import { combineLatest, map, merge } from "rxjs"
import { usePositionContext } from "../Position.context"
import { CtxPositionId, getPosition$ } from "../queries"
import { nsPriceQuote$ } from "./state/cost"
import { onQuantityChanged, onSideChanged, quantityChanged$, selectedSide$ } from "./state/inputs"
import { quantityEdit$ } from "./state/quantity"
import { minQuantity$ } from "./state/validations"
import { Side } from "@/utils/custom"

export const Quantity$ = (id: CtxPositionId) =>
  merge(
    quantityEdit$(id),
    minQuantity$(id),
    selectedSide$(id),
    // getPosition$(id),
  )

const maxQtyWarning$ = state(
  (id: CtxPositionId) =>
    combineLatest([nsPriceQuote$(id), quantityEdit$(id)]).pipe(
      map(([quote, quantity]) => maxQuantityWarning(quote, quantity, (max) => onQuantityChanged(id, max))),
    ),
  null,
)

const minQtyWarning$ = state(
  (id: CtxPositionId) =>
    combineLatest([getPosition$(id), quantityChanged$(id)]).pipe(
      map(([position, { value }]) => minQuantityWarning(position.instrument, value, (min) => onQuantityChanged(id, min))),
    ),
  null,
)

export const Quantity: React.FC = () => {
  const { id, instrument, quantity } = usePositionContext()
  const quantityEdit = useStateObservable(quantityEdit$(id))
  const { side } = useStateObservable(selectedSide$(id))

  const value = (() => {
    if (quantityEdit === null) return null
    else if (quantityEdit === 0n) {
      const { base } = instrument
      const a = Number(toDisplayValue(quantity, base)) * Math.pow(10, base.displayDecimals)
      const mul = BigInt(Number(`1e${base.decimals - base.displayDecimals}`))
      return BigInt(Math.floor(a)) * mul
    } else return absolute(quantityEdit - quantity)
  })()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <BuySellTabButton
          className={side === "Short" ? "bg-functional-sell-500" : "bg-backgrounds-200"}
          onClick={() => onSideChanged(id, Side.Short)}
          testId={`side-${Side.Short}`}
        >
          Sell / Short
        </BuySellTabButton>
        <BuySellTabButton
          className={side === "Long" ? "bg-blue-1" : "bg-backgrounds-200"}
          onClick={() => onSideChanged(id, Side.Long)}
          testId={`side-${Side.Long}`}
        >
          Buy / Long
        </BuySellTabButton>
      </div>
      <CurrencyInput
        className="border-backgrounds-300"
        htmlFor="quantity"
        label="Order Size"
        value={value}
        onFocus={(e) => {
          e.target.select()
        }}
        onChange={(e) => onQuantityChanged(id, e)}
        currency={instrument.base.symbol}
        decimals={instrument.base.decimals}
        displayDecimals={instrument.displayDecimals}
        testIdPrefix="position-edit-quantity"
      />
      {minQtyWarning$(id)}
      {maxQtyWarning$(id)}
    </div>
  )
}
