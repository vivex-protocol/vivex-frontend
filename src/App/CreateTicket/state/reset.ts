import { createSignal } from "@react-rxjs/utils"
import { map, merge, Observable } from "rxjs"

export const [resetForm$, onResetForm] = createSignal()

export function resetable<T, R>(source$: Observable<T>, resetValue: R): Observable<T | R>

export function resetable<T>(source$: Observable<T>): Observable<T | null>
export function resetable(source$: Observable<any>, resetValue = null) {
  return merge(source$, resetForm$.pipe(map(() => resetValue)))
}
