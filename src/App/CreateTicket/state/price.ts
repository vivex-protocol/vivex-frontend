import { getTradeParams, isAboveMinQty, mapQuoteSwapResponse, mapTradeResponse } from "@/App/common"
import { contangoSdk } from "@/api/chain"
import { CtxInstrumentId, ValueOf, availablePairs } from "@/api/graphql/instruments"
import { debug } from "@/utils/debug"
import { createSignalState, unsuspended } from "@/utils/observable-utils"
import { ObservableType, fromEntriesTyped } from "@/utils/types"
import { CashflowCurrency, Side } from "@/utils/custom"
import { SUSPENSE, sinkSuspense, state } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { catchError, combineLatest, concat, debounceTime, filter, from, map, of, scan, switchMap, timer } from "rxjs"
import { Hex } from "viem"
import { unwrapInstrumentId } from "./helpers"
import { leverageInput$, quantity$, slippage$ } from "./inputs"
import { selectedId$ } from "./instrument"

const cheekyMapper = (arr: CtxInstrumentId[], side: Side) => {
  return arr.map((id) => ({ ...unwrapInstrumentId(id), side }))
}

const queryMetas = async (ids: ReturnType<typeof cheekyMapper>) => {
  const metas = await Promise.all(
    ids.map(({ positionId, chainId, side }) =>
      contangoSdk.getMetaData(positionId, chainId).then((meta) => {
        const id: CtxInstrumentId = `${positionId}-${chainId}`
        return { ...meta, chainId, id, side }
      }),
    ),
  )
  return fromEntriesTyped(metas.map((x) => [x.id, x] as const))
}

export const metaValues$ = state((symbol: string) => {
  const { Long, Short } = availablePairs[symbol]
  const ids = [...cheekyMapper(Long, Side.Long), ...cheekyMapper(Short, Side.Short)]
  return timer(0, 10000).pipe(switchMap(() => queryMetas(ids)))
})

export type Meta = ValueOf<ObservableType<ReturnType<typeof metaValues$>>>

export const meta$ = state((id: CtxInstrumentId) => {
  const { chainId, positionId } = unwrapInstrumentId(id)
  return timer(0, 60_000).pipe(
    switchMap(() => from(contangoSdk.getMetaData(positionId, chainId))),
    catchError((err) => {
      console.log(`error querying metadata for id: ${positionId} on chain: ${chainId}`, err)
      return of("error" as const)
    }),
  )
}, null)

const timeDelay = window.location.href.includes("vivex.io") ? 60000 : 1500_000

const [_excluded$, onExcludeFLProvider] = createSignal<Hex>()
const excludedFLProviders$ = state(_excluded$.pipe(scan((acc, next) => acc.add(next), new Set() as Set<Hex>)), new Set() as Set<Hex>)

export { onExcludeFLProvider }

export const priceQuotes$ = state(
  combineLatest([quantity$.pipe(filter((x) => x !== 0n)), leverageInput$, selectedId$]).pipe(
    filter(
      ([
        quantity,
        ,
        {
          pair: { base },
        },
      ]) => isAboveMinQty(quantity, base),
    ),
    switchMap(([quantity, leverage, { positionId, chainId, selectedSide, pair }]) =>
      concat(
        of(SUSPENSE),
        combineLatest([excludedFLProviders$, timer(0, timeDelay)]).pipe(
          switchMap(([excluded]) =>
            Promise.all([
              contangoSdk.quoteTrade(
                positionId,
                // @ts-ignore
                getTradeParams(quantity, selectedSide, leverage, CashflowCurrency.Base, excluded),
                chainId,
              ),
              contangoSdk.quoteTrade(
                positionId,
                // @ts-ignore
                getTradeParams(quantity, selectedSide, leverage, CashflowCurrency.Quote, excluded),
                chainId,
              ),
            ]),
          ),
          map(([resBaseCashflow, resQuoteCashflow]) => ({
            // @ts-ignore
            base: mapTradeResponse(resBaseCashflow, selectedSide, pair, chainId),
            // @ts-ignore
            quote: mapTradeResponse(resQuoteCashflow, selectedSide, pair, chainId),
          })),
        ),
      ),
    ),
    sinkSuspense(),
  ),
)

export const nsPriceQuotes$ = state(priceQuotes$.pipe(unsuspended))

export const [selectedCashflowCcy$, setSelectedCashflowCcy] = createSignalState<"base" | "quote">("quote")

export const priceQuote$ = state(
  combineLatest([priceQuotes$, selectedCashflowCcy$]).pipe(map(([quotes, selectedCashflowCcy]) => quotes[selectedCashflowCcy])),
)

export const nsPriceQuote$ = state(priceQuote$.pipe(unsuspended))

export const tradeQuotes$ = state(
  combineLatest([priceQuote$, slippage$]).pipe(
    debounceTime(500),
    debug("tradeQuotes$"),
    switchMap(([quote, slippage]) =>
      quote.tradeQuantity === 0n
        ? of(SUSPENSE)
        : concat(
            of(SUSPENSE),
            from(contangoSdk.quoteSwap(quote, BigInt(Math.floor(slippage * 1e16)), quote.chainId)).pipe(
              map((trades) => mapQuoteSwapResponse(trades, quote)),
            ),
          ),
    ),
  ),
)
