import { CtxInstrumentId, Pair, availablePairs } from "@/api/graphql/instruments"
import { createSignalState } from "@/utils/observable-utils"
import { state } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { combineLatest, map, startWith, switchMap } from "rxjs"
import { unwrapInstrumentId } from "./helpers"
import { selectedSide$ } from "./inputs"

export const [selectedPair$, onPairSelected] = createSignalState<Pair>(Object.values(availablePairs)[0])

const [_selectedId$, onSelectPositionId] = createSignal<CtxInstrumentId>()
export { onSelectPositionId }

const lastSelectedId$ = state(_selectedId$.pipe(map((id) => unwrapInstrumentId(id))), null)

export const selectedId$ = state(
  combineLatest([selectedPair$, selectedSide$, lastSelectedId$]).pipe(
    switchMap(([pair, selectedSide, lastSelected]) => {
      const defaultId = (() => {
        const ids = pair[selectedSide].length > 0 ? pair[selectedSide] : pair.Long.length > 0 ? pair.Long : pair.Short
        return (
          ids.find((id) => {
            const { chainId, mm } = unwrapInstrumentId(id)
            return chainId === lastSelected?.chainId && mm === lastSelected?.mm
          }) || ids[0]
        )
      })()
      return _selectedId$.pipe(
        startWith(defaultId),
        map((id) => {
          const { chainId, positionId, side, mm } = unwrapInstrumentId(id)
          return { chainId, positionId, id, selectedSide: side, pair, mm }
        }),
      )
    }),
  ),
)

export const [userSearch$, onUserSearch] = createSignalState("")

export const filteredPairs$ = state(
  userSearch$.pipe(
    map((str) => str.split("/").join("")),
    map((search) =>
      Object.values(availablePairs).filter(({ base, quote }) =>
        `${base.symbol}${quote.symbol}`.toLowerCase().includes(search.toLowerCase()),
      ),
    ),
  ),
)
