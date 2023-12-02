import { filterOutSuspenseAndNull } from "@/utils/observable-utils"
import { liftSuspense, state } from "@react-rxjs/core"
import { concat, map, of, pluck, switchMap, take, withLatestFrom } from "rxjs"
import { CtxPositionId, getPositionStatus$ } from "../../queries"
import { EditType, positionEditFlow$ } from "./base"
import { priceQuote$ } from "./cost"
import { leverageInput$ } from "./inputs"

export const collateralUsed$ = state((positionId: CtxPositionId) =>
  priceQuote$(positionId).pipe(
    map(({ cashflow: { value } }) => value),
    liftSuspense(),
    filterOutSuspenseAndNull(),
  ),
)

export const leverageValue$ = state((id: CtxPositionId) => {
  return positionEditFlow$(id).pipe(
    switchMap((flow) =>
      flow === EditType.none ? of(null) : concat(getPositionStatus$(id).pipe(pluck("leverage"), take(1)), leverageInput$(id)),
    ),
  )
})

export const hasLeverageDelta$ = state((id: CtxPositionId) =>
  leverageValue$(id).pipe(
    withLatestFrom(getPositionStatus$(id)),
    map(([lev, { leverage: init }]) => lev !== init),
  ),
)
