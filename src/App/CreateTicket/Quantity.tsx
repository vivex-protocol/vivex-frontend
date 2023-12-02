import { CurrencyInput } from "@/components/CurrencyInput"
import { InputValidationState } from "@/components/NumberInput"
import { unsuspended } from "@/utils/observable-utils"
import { liftSuspense, state, SUSPENSE, useStateObservable } from "@react-rxjs/core"
import { combineLatest, map } from "rxjs"
import { maxQuantityWarning, minQuantityWarning } from "../common/components"
import { nsPriceQuote$, priceQuote$, selectedPair$ } from "./state"
import { onQuantityChanged, quantity$ } from "./state/inputs"

const isLoading$ = state(
  priceQuote$.pipe(
    liftSuspense(),
    map((x) => x === SUSPENSE),
  ),
  true,
)

const eqv$ = state(nsPriceQuote$.pipe(map(({ resultingPosition: { value }, pair }) => `(${value} ${pair.quote.symbol})`)), null)

const minQtyWarning$ = state(
  combineLatest([nsPriceQuote$, quantity$]).pipe(
    map(([quote, quantity]) => minQuantityWarning(quote.pair, quantity, onQuantityChanged)),
    unsuspended,
  ),
  null,
)

const maxQtyWarning$ = state(
  combineLatest([nsPriceQuote$, quantity$]).pipe(
    map(([quote, quantity]) => maxQuantityWarning(quote, quantity, onQuantityChanged)),
    unsuspended,
  ),
  null,
)

const validationState$ = state(
  combineLatest([nsPriceQuote$, quantity$]).pipe(
    map(([{ maxQuantity }, qty]) => (qty && qty > maxQuantity ? InputValidationState.Error : InputValidationState.Valid)),
  ),
  InputValidationState.Valid,
)

export const Quantity = () => {
  const validationState = useStateObservable(validationState$)

  const isLoading = useStateObservable(isLoading$)
  const quantity = useStateObservable(quantity$)
  const pair = useStateObservable(selectedPair$)

  const label = (
    <span>
      Value <span className={isLoading ? "blur-sm" : ""}>{eqv$}</span>
    </span>
  )

  return (
    <div data-testid="create-ticket--quantity" className="flex flex-col gap-2">
      <span className="px-2 text-fontColor-500 text-sm">Size</span>
      <CurrencyInput
        className="border-backgrounds-300"
        htmlFor="quantity"
        label={label}
        value={quantity}
        onChange={onQuantityChanged}
        decimals={pair.base.decimals}
        currency={pair.base.symbol}
        displayDecimals={pair.base.displayDecimals}
        testIdPrefix="create-ticket-quantity"
        validationState={validationState}
      />
      {minQtyWarning$}
      {maxQtyWarning$}
    </div>
  )
}
