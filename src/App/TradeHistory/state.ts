import { chains } from "@/api/chain"
import { getHistoryItems, HistoryItem } from "@/api/graphql/positions"
import { createSignalState } from "@/utils/observable-utils"
import { state } from "@react-rxjs/core"
import { catchError, map, merge, of, scan, shareReplay, switchMap } from "rxjs"
import { Hex } from "viem"

export const [filters$, setFilters] = createSignalState({ positionId: "" })

export const filterCount$ = state(filters$.pipe(map((filters) => Object.values(filters).filter(Boolean).length)))

export const transactionHistory$ = state((trader: Hex) =>
  filters$.pipe(
    switchMap((filters) =>
      merge(
        ...chains.map((chain) => {
          return getHistoryItems({ trader, ...filters }, chain.graphUrls, chain.id).pipe(
            catchError((err) => {
              console.error("Failed to load trades", err)
              return of(null)
            }),
          )
        }),
      ).pipe(
        scan((acc, curr) => (curr ? [...acc, ...curr] : acc), [] as HistoryItem[]),
        map((items) => items.sort((a, b) => b.blockTimestamp - a.blockTimestamp)),
      ),
    ),
    shareReplay(1),
  ),
)

export const TransactionHistory$ = (acc: Hex) => merge(transactionHistory$(acc), filterCount$)
