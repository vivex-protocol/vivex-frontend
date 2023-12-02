import { toDisplayValue } from "@/components/CurrencyDisplay"
import { MAX_INT_256 } from "@/utils/constants"
import { mapDistinct } from "@/utils/observable-utils"
import { state } from "@react-rxjs/core"
import { combineLatest, debounceTime, filter, map, of, switchMap } from "rxjs"
import { CtxPositionId, getPosition$ } from "../../queries"
import { EditType, positionEditFlow$ } from "./base"
import { quantityChanged$, selectedSide$ } from "./inputs"

export const quantityDelta$ = state(
  (positionId: CtxPositionId) =>
    positionEditFlow$(positionId).pipe(
      switchMap((flow) => {
        if (flow === EditType.none) return of(null)
        if (flow === EditType.close) return of(-MAX_INT_256)
        return combineLatest([
          quantityChanged$(positionId).pipe(
            filter((x) => x.value !== 0n),
            mapDistinct((e) => e.value),
            debounceTime(1000),
          ),
          getPosition$(positionId),
          selectedSide$(positionId),
        ]).pipe(
          map(
            ([
              qtyDelta,
              {
                quantity,
                instrument: { base },
              },
              { multiplier },
            ]) => {
              if (qtyDelta === null) return null
              const delta = qtyDelta * multiplier
              if (delta < -quantity || toDisplayValue(-quantity, base) === toDisplayValue(delta, base)) return -MAX_INT_256
              return delta
            },
          ),
        )
      }),
    ),
  null,
)

export const quantityEdit$ = state(
  (positionId: CtxPositionId) =>
    combineLatest([quantityDelta$(positionId), getPosition$(positionId)]).pipe(
      map(([delta, position]) => {
        if (delta === null) return null
        if (delta === -MAX_INT_256) return 0n
        return position.quantity + delta
      }),
    ),
  null,
)

export enum QuantityValidity {
  VALID = "Valid",
  NIL = "Nil",
  ZERO = "Zero",
}

export type QuantityState =
  | { state: QuantityValidity.NIL }
  | { state: QuantityValidity.ZERO }
  | { state: QuantityValidity.VALID; value: bigint }

export const quantityState$ = state((positionId: CtxPositionId) => {
  return quantityEdit$(positionId).pipe(
    map((value): QuantityState => {
      if (value === null) return { state: QuantityValidity.NIL }
      if (value === 0n) return { state: QuantityValidity.ZERO }
      return { state: QuantityValidity.VALID, value }
    }),
  )
})

export const isClosingPosition$ = state(
  (positionId: CtxPositionId) => quantityState$(positionId).pipe(mapDistinct(({ state }) => state === QuantityValidity.ZERO)),
  false,
)
