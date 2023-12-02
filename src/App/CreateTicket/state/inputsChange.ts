import { merge, share } from "rxjs"
import { leverageInput$, quantity$ } from "./inputs"
// import { selectedPair$ } from "./instrument"

export const formChangeEvents$ = merge(
  // selectedPair$,
  quantity$,
  leverageInput$,
).pipe(share())

// make the stream hot. Needed to prevent emission on subscribe.
formChangeEvents$.subscribe()
