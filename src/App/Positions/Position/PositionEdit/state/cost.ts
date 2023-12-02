import { getTradeParams, isAboveMinQty, mapQuoteSwapResponse, mapTradeResponse } from "@/App/common"
import { contangoSdk } from "@/api/chain"
import { unsuspended } from "@/utils/observable-utils"
import { CashflowCurrency } from "@/vivex-xyz/sdk"
import { SUSPENSE, liftSuspense, sinkSuspense, state } from "@react-rxjs/core"
import { createKeyedSignal } from "@react-rxjs/utils"
import { combineLatest, concat, debounceTime, filter, from, map, of, scan, switchMap, timer } from "rxjs"
import { Hex } from "viem"
import { CtxPositionId, getPosition$, unwrapId } from "../../queries"
import { EditType, positionEditFlow$ } from "./base"
import { selectedCashflowCcy$, slippage$ } from "./inputs"
import { hasLeverageDelta$, leverageValue$ } from "./leverage"
import { quantityDelta$ } from "./quantity"

export const timeDelay = window.location.href.includes("vivex.io") ? 60000 : 1500_000

const [_excluded$, onExcludeFLProvider] = createKeyedSignal(
  ({ positionId }) => positionId,
  (positionId: CtxPositionId, flp: Hex) => ({ positionId, flp }),
)

const excludedFLPs$ = state(
  (id: CtxPositionId) => _excluded$(id).pipe(scan((acc, { flp }) => acc.add(flp), new Set() as Set<Hex>)),
  new Set() as Set<Hex>,
)

export { onExcludeFLProvider }

export const priceQuotes$ = state((id: CtxPositionId) =>
  positionEditFlow$(id).pipe(
    switchMap((flow) =>
      flow === EditType.none
        ? of(SUSPENSE)
        : combineLatest({
            quantityDelta: quantityDelta$(id),
            leverageValue: leverageValue$(id).pipe(debounceTime(1000)),
            position: getPosition$(id),
          }).pipe(
            filter(({ quantityDelta, position }) => isAboveMinQty(quantityDelta, position.instrument.base)),
            switchMap(({ quantityDelta, leverageValue, position }) => {
              const { positionId, chainId } = unwrapId(id)
              const { instrument } = position
              return concat(
                of(SUSPENSE),
                combineLatest([excludedFLPs$(id), timer(0, timeDelay)]).pipe(
                  switchMap(([excluded]) =>
                    Promise.all([
                      contangoSdk.quoteTrade(
                        positionId,
                        // @ts-ignore
                        getTradeParams(quantityDelta, instrument.side, leverageValue, CashflowCurrency.Base, excluded),
                        chainId,
                      ),
                      contangoSdk.quoteTrade(
                        positionId,
                        // @ts-ignore
                        getTradeParams(quantityDelta, instrument.side, leverageValue, CashflowCurrency.Quote, excluded),
                        chainId,
                      ),
                    ]),
                  ),
                  map(([resBaseCashflow, resQuoteCashflow]) => ({
                    // @ts-ignore
                    base: mapTradeResponse(resBaseCashflow, instrument.side, instrument, chainId),
                    // @ts-ignore
                    quote: mapTradeResponse(resQuoteCashflow, instrument.side, instrument, chainId),
                  })),
                ),
              )
            }),
          ),
    ),
    sinkSuspense(),
  ),
)

export const nsPriceQuotes$ = state((id: CtxPositionId) => unsuspended(priceQuotes$(id)))

export const priceQuote$ = state((id: CtxPositionId) =>
  combineLatest([priceQuotes$(id), selectedCashflowCcy$(id)]).pipe(map(([quotes, key]) => quotes[key])),
)

export const nsPriceQuote$ = state((id: CtxPositionId) => unsuspended(priceQuote$(id)))

export const loadingPriceQuote$ = state(
  (id: CtxPositionId) =>
    priceQuote$(id).pipe(
      liftSuspense(),
      map((quote) => quote === SUSPENSE),
    ),
  true,
)

export const tradeQuotes$ = state((id: CtxPositionId) =>
  combineLatest([nsPriceQuote$(id), slippage$(id), quantityDelta$(id), hasLeverageDelta$(id)]).pipe(
    debounceTime(500),
    filter(([, , quantityDelta, hasLeverageDelta]) => Boolean(quantityDelta) || hasLeverageDelta),
    switchMap(([quote]) =>
      concat(
        of(SUSPENSE),
        from(contangoSdk.quoteSwap(quote, BigInt(0.005e18), quote.chainId)).pipe(map((trades) => mapQuoteSwapResponse(trades, quote))),
      ),
    ),
  ),
)

export const nsTradeQuotes$ = state((id: CtxPositionId) => unsuspended(tradeQuotes$(id)))
export const loadingTradeQuotes$ = state(
  (id: CtxPositionId) =>
    tradeQuotes$(id).pipe(
      liftSuspense(),
      map((quote) => quote === SUSPENSE),
    ),
  false,
)
