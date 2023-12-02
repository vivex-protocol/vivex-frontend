import { combineLatest$, mapDistinct } from "@/utils/observable-utils"
import { state } from "@react-rxjs/core"
import { of, switchMap } from "rxjs"
import { CtxPositionId } from "../../queries"
import { hasLeverageDelta$ } from "./leverage"
import { QuantityValidity, quantityDelta$ } from "./quantity"

export const minQuantity$ = state((positionId: string) => of(0n), 0n)
const quantityState$ = (...args: any[]) => of({ state: QuantityValidity.ZERO, value: 0n })

export const areInputsValidAndHasDeltas$ = state((positionId: CtxPositionId) => {
  const isQuantityValid$ = quantityState$(positionId).pipe(mapDistinct((q) => q.state === QuantityValidity.VALID))

  const qDelta$ = quantityDelta$(positionId)
  const hasLDelta$ = hasLeverageDelta$(positionId)

  const hasDeltas$ = combineLatest$({
    qDelta$,
    hasLDelta$,
  }).pipe(mapDistinct(({ qDelta, hasLDelta }) => qDelta !== 0n || hasLDelta))

  return isQuantityValid$.pipe(switchMap((isValid) => (isValid ? hasDeltas$ : [false])))
}, false)
