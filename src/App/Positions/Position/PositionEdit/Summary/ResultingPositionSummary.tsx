import { labelJsx, spotPriceJsx } from "@/App/common/priceDisplay"
import { toDisplayValue } from "@/components/CurrencyDisplay"
import { getPnlColor } from "@/components/PnL"
import { roundToTwo } from "@/utils/rounding"
import { Side, mulDiv } from "@/vivex-xyz/sdk"
import { state, useStateObservable } from "@react-rxjs/core"
import { combineLatest, map, merge, startWith } from "rxjs"
import { usePositionContext } from "../../Position.context"
import { posDivider } from "../../PositionView/Shared"
import { CtxPositionId, getPosition$, getPositionStatus$ } from "../../queries"
import { loadingPriceQuote$, loadingTradeQuotes$, nsPriceQuote$, nsTradeQuotes$, tradeQuotes$ } from "../state/cost"
import { quantityEdit$ } from "../state/quantity"
import { ResultingPositionRow, SummaryTable } from "./SummaryTable"

const spotPrice$ = state(
  (id: CtxPositionId) => combineLatest([tradeQuotes$(id), quantityEdit$(id)]).pipe(map(([data, quantity]) => spotPriceJsx(data, quantity))),
  null,
)

const newEntryPrice$ = state(
  (id: CtxPositionId) =>
    combineLatest([nsTradeQuotes$(id).pipe(startWith(null)), getPosition$(id)]).pipe(
      map(([data, { quantity, instrument, openCost, entryPrice }]) => {
        if (data === null) return toDisplayValue(entryPrice, instrument.quote)
        const { trades, quote } = data
        const { unit: baseUnit } = instrument.base
        let newEntryPrice = 0n
        if (quote.quantity < 0n) {
          const newOpenCost = mulDiv(openCost, quantity + quote.quantity, quantity)
          // @ts-ignore
          newEntryPrice = mulDiv(newOpenCost, baseUnit, quantity + quote.quantity)
        } else {
          // @ts-ignore
          newEntryPrice = mulDiv(openCost + trades[0].cost, baseUnit, quantity + quote.quantity)
        }
        if (data.quote.fullyClosing) return "N/A"
        return toDisplayValue(newEntryPrice, instrument.quote)
      }),
    ),
  null,
)

export const ResultingPositionSummary$ = state((id: CtxPositionId) =>
  merge(nsPriceQuote$(id), loadingPriceQuote$(id), getPositionStatus$(id), spotPrice$(id), loadingTradeQuotes$(id)),
)

export const EditPositionSummary: React.FC = () => {
  const position = usePositionContext()
  const { id, instrument } = position
  const { base, quote } = instrument
  const { quantity, resultingPosition, fullyClosing } = useStateObservable(nsPriceQuote$(id))
  const status = useStateObservable(getPositionStatus$(id))
  const loading = useStateObservable(loadingPriceQuote$(id))
  const loadingTrade = useStateObservable(loadingTradeQuotes$(id))
  const multiplier = instrument.side === Side.Short ? -1n : 1n
  const toQuantity = position.sQuantity + quantity * multiplier

  return (
    <SummaryTable className="text-sm">
      <ResultingPositionRow
        title="Size:"
        from={<span className={getPnlColor(position.sQuantity)}>{toDisplayValue(position.sQuantity, base, { formatAsDelta: true })}</span>}
        to={
          fullyClosing ? (
            "Closed"
          ) : (
            <span className={getPnlColor(toQuantity)}>{toDisplayValue(toQuantity, base, { formatAsDelta: true })}</span>
          )
        }
        resultingTestId="Size"
      />
      <ResultingPositionRow
        title="Margin (min):"
        from={`${roundToTwo(status.margin)}%`}
        to={
          fullyClosing ? (
            "N/A"
          ) : (
            <div className="flex gap-1">
              {`${resultingPosition.margin}%`}
              <span className="text-fontColor-500">{`(${roundToTwo(status.minMargin)}%)`}</span>
            </div>
          )
        }
        tooltipKey="margin"
        resultingTestId="margin"
        loading={loading}
      />
      <ResultingPositionRow
        title="Entry Price:"
        from={toDisplayValue(position.entryPrice, quote)}
        to={newEntryPrice$(id)}
        tooltipKey="entryPrice"
        resultingTestId="entryPrice"
        loading={loadingTrade}
      />
      <ResultingPositionRow
        title="Liquidation Price:"
        from={toDisplayValue(status.liquidationPrice, quote)}
        to={fullyClosing ? "N/A" : toDisplayValue(resultingPosition.liquidationPrice, quote)}
        tooltipKey="liquidationPrice"
        resultingTestId="liquidationPrice"
        loading={loading}
      />
      {posDivider}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex justify-between h-8 items-center">
          {labelJsx("Mark Price", "markPrice")}
          {toDisplayValue(status.markPrice, quote)}
        </div>
        {spotPrice$(id)}
      </div>
    </SummaryTable>
  )
}
