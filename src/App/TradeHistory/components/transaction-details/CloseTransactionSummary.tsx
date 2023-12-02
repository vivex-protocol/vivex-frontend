import { HistoryItem } from "@/api/graphql/positions"
import { SummaryRow, SummaryTable } from "@/App/Positions/Position/PositionEdit/Summary/SummaryTable"
import { posDivider } from "@/App/Positions/Position/PositionView/Shared"
import { toCurrencyDisplay } from "@/components/CurrencyDisplay"
import { formatDate } from "@/utils/mappers"
import { absolute } from "@/vivex-xyz/sdk"

const testId = (field: string) => "close-transaction-summary--" + field

export const CloseTransactionSummary: React.FC<HistoryItem> = ({
  executionPrice,
  realisedPnL,
  fee,
  previousFees,
  openQuantityDelta,
  cashflow,
  blockTimestamp,
  instrument: { base, quote },
  executionFee,
}) => {
  const pnlAfterFees = realisedPnL - fee - previousFees - executionFee

  return (
    <div className="flex flex-col">
      <SummaryTable>
        <SummaryRow testId={testId("date")} title="Date and Time">
          {formatDate(blockTimestamp)}
        </SummaryRow>
        {posDivider}
        <SummaryRow testId={testId("size")} title="Trade Size" tooltipKey="tradeSize">
          {toCurrencyDisplay(openQuantityDelta, base)}
        </SummaryRow>
        <SummaryRow title="User Cashflow" tooltipKey="userCashflow">
          {toCurrencyDisplay(cashflow.value, cashflow.ccy)}
        </SummaryRow>
        <SummaryRow testId={testId("exitPrice")} title="Exit Price">
          {
            // @ts-ignore
            toCurrencyDisplay(executionPrice, quote)
          }
        </SummaryRow>
        {posDivider}
        <SummaryRow title={realisedPnL >= 0 ? "Profit" : "Loss"}>
          {toCurrencyDisplay(absolute(realisedPnL), quote)}
          {/* <CurrencyDisplay
            testId={testId("grossPnL")}
            currencyId={quote}
            value={absolute(realisedPnL)}
            className={getPnlColor(realisedPnL)}
          /> */}
        </SummaryRow>
        <SummaryRow testId={testId("openingFees")} title="Open/Modify Fees">
          {toCurrencyDisplay(previousFees, quote)}
        </SummaryRow>
        <SummaryRow testId={testId("closingFee")} title="Closing Fee">
          {toCurrencyDisplay(fee, quote)}
        </SummaryRow>
        <SummaryRow testId={testId("executionFee")} title="Execution Fee">
          {toCurrencyDisplay(executionFee, quote)}
        </SummaryRow>
        {posDivider}
        <SummaryRow title={"Net " + (pnlAfterFees >= 0 ? "Profit" : "Loss")}>
          {toCurrencyDisplay(absolute(pnlAfterFees), quote)}
          {/* <CurrencyDisplay
            testId={testId("netPnL")}
            currencyId={quote}
            value={absolute(pnlAfterFees)}
            className={getPnlColor(pnlAfterFees)}
          /> */}
        </SummaryRow>
      </SummaryTable>
    </div>
  )
}
