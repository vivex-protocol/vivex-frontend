import { HistoryItem } from "@/api/graphql/positions"
import { ResultingPositionRow, SummaryRow, SummaryTable } from "@/App/Positions/Position/PositionEdit/Summary/SummaryTable"
import { toCurrencyDisplay, toDisplayValue } from "@/components/CurrencyDisplay"
import { formatDate } from "@/utils/mappers"

export const EditTransactionSummary: React.FC<HistoryItem> = (item) => {
  return (
    <div className="flex flex-col gap-3">
      <TransactionSummary {...item} />
      <ResultingPosition {...item} />
    </div>
  )
}

const TransactionSummary: React.FC<HistoryItem> = ({ openQuantityDelta, cashflow, blockTimestamp, instrument: { base } }) => {
  return (
    <SummaryTable>
      <SummaryRow title="Date and time">{formatDate(blockTimestamp)}</SummaryRow>
      <SummaryRow title="Trade Size" tooltipKey="tradeSize">
        {openQuantityDelta ? toCurrencyDisplay(openQuantityDelta, base, { formatAsDelta: true }) : "No change"}
      </SummaryRow>
      <SummaryRow title="User Cashflow" tooltipKey="userCashflow">
        {cashflow.value === 0n
          ? "No change"
          : toCurrencyDisplay(cashflow.value, cashflow.ccy, {
              formatAsDelta: true,
            })}
      </SummaryRow>
    </SummaryTable>
  )
}

const ResultingPosition: React.FC<HistoryItem> = ({
  previousOpenQuantity,
  openCost,
  openQuantity,
  previousOpenCost,
  previousEntryPrice,
  entryPrice,
  collateral,
  previousCollateral,
  instrument,
}) => {
  return (
    <>
      <SummaryTable>
        <ResultingPositionRow
          title="Position Size"
          from={toCurrencyDisplay(previousOpenQuantity, instrument.base)}
          to={toCurrencyDisplay(openQuantity, instrument.base)}
          resultingTestId="quantity"
        />
        <ResultingPositionRow
          title="Collateral"
          from={toDisplayValue(previousCollateral, instrument.quote)}
          to={toCurrencyDisplay(collateral, instrument.quote)}
          resultingTestId="collateral"
        />
        <ResultingPositionRow
          title="Entry Price"
          from={toDisplayValue(previousEntryPrice, instrument.quote)}
          to={toCurrencyDisplay(entryPrice, instrument.quote)}
          resultingTestId="entryPrice"
        />
        <ResultingPositionRow
          title="Value"
          from={toDisplayValue(previousOpenCost, instrument.quote)}
          to={toCurrencyDisplay(openCost, instrument.quote)}
          resultingTestId="openCost"
        />
      </SummaryTable>
    </>
  )
}
