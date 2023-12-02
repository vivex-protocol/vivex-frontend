import { liftSuspense, state, SUSPENSE } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import {
  combineLatest,
  concat,
  defer,
  filter,
  from,
  interval,
  map,
  merge,
  Observable,
  ObservableInput,
  ObservedValueOf,
  OperatorFunction,
  Subscription,
  switchMap,
} from "rxjs"

const NIL = {}

// it creates an observable that waits a certain amount of ms and then completes
export const justWait = (ms: number) =>
  new Observable<never>((observer) => {
    const token = setTimeout(() => {
      observer.complete()
    }, ms)

    return () => {
      clearTimeout(token)
    }
  })

// a pipeable operator that delays the subscription of its source Observable,
// unlike `delay` which delays the first emission.
export const delaySubscription =
  (ms: number) =>
  <T>(src$: Observable<T>) =>
    concat(justWait(ms), src$)

// Like the `map` operator, but it doesn't emit unless the new mapped value
// is different than the previously emitted value
export const mapDistinct =
  <I, O>(mapper: (input: I, idx?: number) => O) =>
  (src$: Observable<I>) =>
    new Observable<O>((observer) => {
      let lastValue: O | typeof NIL = NIL
      let idx = 0
      return src$.subscribe({
        next(value) {
          let mapped: O
          try {
            mapped = mapper(value, idx)
          } catch (e) {
            return observer.error(e)
          }
          if (mapped === lastValue) return

          idx++
          lastValue = mapped
          observer.next(mapped)
        },
        error(e) {
          observer.error(e)
        },
        complete() {
          observer.complete()
        },
      })
    })

const filterOutSuspenseAndNullEnhancer = filter(
  <T>(value: T): value is Exclude<T, typeof SUSPENSE | null> => value !== (SUSPENSE as any) && value !== null,
)
export const filterOutSuspenseAndNull = () => filterOutSuspenseAndNullEnhancer

const filterOutSuspenseEnhancer = filter(<T>(value: T): value is Exclude<T, typeof SUSPENSE> => value !== (SUSPENSE as any))

export const filterOutSuspense = () => filterOutSuspenseEnhancer

const filterOutNullEnhancer = filter(<T>(value: T): value is Exclude<T, null> => value !== null)

export const filterOutNull = () => filterOutNullEnhancer

export const suspenseToNull =
  () =>
  <T extends any>(source$: Observable<T>) =>
    source$.pipe(
      liftSuspense(),
      map((val) => (val === SUSPENSE ? null : val)),
    )

const throwErrorsEnhancer = map(<T>(input: T): Exclude<T, Error> => {
  if (input instanceof Error) throw input
  return input as any
})
export const throwErrors = () => throwErrorsEnhancer

export const unsuspended = <T>(source$: Observable<T | typeof SUSPENSE>): Observable<T> => source$.pipe(liftSuspense(), filterOutSuspense())

export const withNullFrom =
  <T1 extends any>(predicate$: Observable<T1 | null>) =>
  <T2 extends any>(source$: Observable<T2>) =>
    merge(predicate$.pipe(filter((x): x is null => x === null)), source$)

export const nullWhen =
  (predicate$: Observable<boolean>) =>
  <T2 extends any>(source$: Observable<T2>) =>
    combineLatest([predicate$, source$]).pipe(map(([bool, val]) => (bool ? null : val)))

export const withLogs =
  (debuggerId: string) =>
  <T>(src: Observable<T>): Observable<T> =>
    new Observable((observer) => {
      console.log(`subscribing ${debuggerId}`)
      const subs = src.subscribe({
        next(value) {
          console.log({ value, debuggerId })
          observer.next(value)
        },
        error(e) {
          console.log({ error: e, debuggerId })
          observer.error(e)
        },
        complete() {
          console.log({ debuggerId, complete: true })
          observer.complete()
        },
      })
      return () => {
        console.log(`unsubscribing ${debuggerId}`)
        return subs.unsubscribe()
      }
    })

const NO_VAL: any = {}

export const continueWith =
  <T, O extends ObservableInput<any>>(mapper: (value: T) => O): OperatorFunction<T, T | ObservedValueOf<O>> =>
  (source$) =>
    new Observable((observer) => {
      let latestValue: T = NO_VAL
      const subscription = new Subscription()

      subscription.add(
        source$.subscribe({
          complete: () => {
            if (latestValue === NO_VAL) {
              observer.complete()
            } else {
              const nextObservable$ = from(mapper(latestValue))
              subscription.add(nextObservable$.subscribe(observer))
            }
          },
          error: (e) => {
            observer.error(e)
          },
          next: (val) => {
            observer.next((latestValue = val))
          },
        }),
      )

      return subscription
    })

type RemoveTrailing$<T extends string> = T extends `${infer R}$` ? R : T
export function combineLatest$<T extends Record<string, ObservableInput<any>>>(
  sourcesObject: T,
): Observable<{
  [K in keyof T & string as RemoveTrailing$<K>]: ObservedValueOf<T[K]>
}> {
  const transformedSources = mapObjKeys(sourcesObject, (key) => key.replace(/\$$/, ""))

  return combineLatest(transformedSources) as any
}

type KeyType = string | number | symbol

export const mapObj = <K extends KeyType, V, K2 extends KeyType, V2>(obj: Record<K, V>, mapFn: (key: K, value: V) => [K2, V2]) =>
  Object.fromEntries(Object.entries(obj).map(([key, value]) => mapFn(key as K, value as V))) as Record<K2, V2>

export const mapObjKeys = <K extends KeyType, V, K2 extends KeyType>(obj: Record<K, V>, mapFn: (key: K, value: V) => K2) =>
  mapObj(obj, (key, value) => [mapFn(key, value), value])

export const createSignalState = <T extends any>(initial: T) => {
  const [signal$, setSignal] = createSignal<T>()
  const state$ = state(signal$, initial)
  return [state$, setSignal] as const
}

export const withLatest =
  <A extends Array<any>, T>(input: (...args: A) => Promise<T>, pollingInterval = 60_000): ((...args: A) => Observable<T>) =>
  (...args: A) =>
    concat(
      defer(() => input(...args)),
      interval(pollingInterval).pipe(switchMap(() => input(...args))),
    )
