import { loading as defaultLoading } from "../components/Loading"
import { liftSuspense, SUSPENSE } from "@react-rxjs/core"
import { combineLatest, distinctUntilChanged, map, Observable, pairwise, pipe, startWith } from "rxjs"
import { mapDistinct } from "./observable-utils"

export const withLoading = (loading?: JSX.Element) =>
  pipe(
    liftSuspense(),
    mapDistinct((value) => (value === SUSPENSE ? loading ?? defaultLoading : value)),
  )

export const withBlur = () =>
  pipe(
    liftSuspense(),
    startWith(null),
    pairwise(),
    map(([prev, value]) => {
      if (value === SUSPENSE && prev === SUSPENSE) return null
      if (value === SUSPENSE) {
        return <span className="blur-sm">{prev as any}</span>
      }
      return value
    }),
  )

export const withBlurAndHide =
  <T extends any>(hideWhenNull$: Observable<T | null>) =>
  (source$: Observable<JSX.Element>) => {
    return combineLatest([hideWhenNull$, source$.pipe(liftSuspense(), distinctUntilChanged(), pairwise())]).pipe(
      map(([hidden, [prev, value]]) => {
        const mostRecentJsx = value !== SUSPENSE ? value : prev
        const className = hidden === null ? "hidden" : value === SUSPENSE ? "blur-sm pointer-events-none" : ""
        return <span className={className}>{mostRecentJsx !== SUSPENSE ? mostRecentJsx : null}</span>
      }),
    )
  }
