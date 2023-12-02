import { Observable } from "rxjs"
import { tap } from "rxjs/operators"

export const debug =
  (key: string) =>
  <T>(source$: Observable<T>): Observable<T> =>
    source$.pipe(
      tap(
        (x) => {
          console.log(key, x)
        },
        (e) => {
          console.error(key, e)
        },
        () => {
          console.log(`$${key}: completed`)
        },
      ),
    )
