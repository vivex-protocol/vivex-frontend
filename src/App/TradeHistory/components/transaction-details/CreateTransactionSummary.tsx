import { HistoryItem } from "@/api/graphql/positions"
import { SummaryRow, SummaryTable } from "@/App/Positions/Position/PositionEdit/Summary/SummaryTable"
import { toCurrencyDisplay } from "@/components/CurrencyDisplay"
import { formatDate } from "@/utils/mappers"

const testId = (field: string) => "create-transaction-summary--" + field

export const CreateTransactionSummary: React.FC<HistoryItem> = ({
  openQuantityDelta,
  blockTimestamp,
  cashflow,
  executionPrice,
  fee,
  instrument: { base, quote },
}) => {
  return (
    <>
      <SummaryTable>
        <SummaryRow title="Date and time">
          <div data-testid={testId("date")}>{formatDate(blockTimestamp)}</div>
        </SummaryRow>
        <SummaryRow title="Quantity">{toCurrencyDisplay(openQuantityDelta, base)}</SummaryRow>
        <SummaryRow title="Collateral">{toCurrencyDisplay(cashflow.value, cashflow.ccy)}</SummaryRow>
        <SummaryRow title="Entry Price">
          {
            // @ts-ignore
            toCurrencyDisplay(executionPrice, quote)
          }
        </SummaryRow>
        <SummaryRow title="Trading Fee">{toCurrencyDisplay(fee, quote)}</SummaryRow>
      </SummaryTable>
    </>
  )
}
