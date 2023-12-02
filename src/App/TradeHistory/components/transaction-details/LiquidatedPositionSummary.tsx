import { ResultingPositionRow, SummaryRow, SummaryTable } from "@/App/Positions/Position/PositionEdit/Summary/SummaryTable"
import { HistoryItem } from "@/api/graphql/positions"
import { toCurrencyDisplay } from "@/components/CurrencyDisplay"
import { PnLDelta, getPnlColor } from "@/components/PnL"
import { TabButton, Tabs } from "@/components/Tabs"
import { formatDate } from "@/utils/mappers"
import { roundToTwo } from "@/utils/rounding"
import { absolute } from "@/vivex-xyz/sdk"
import { useState } from "react"

export const LiquidatedPositionSummary: React.FC<HistoryItem> = (item) => {
  const { openQuantity, openQuantityDelta } = item
  const wasFullyLiquidated = openQuantity === 0n

  const [selectedTab, setSelectedTab] = useState<"Resulting" | "TransactionDetails">("Resulting")

  if (wasFullyLiquidated)
    return (
      <>
        <LiquidationTransactionSummary {...item} />
        <div>Your position was fully liquidated</div>
      </>
    )

  return (
    <>
      <Tabs>
        <TabButton isActive={selectedTab === "Resulting"} onClick={() => setSelectedTab("Resulting")}>
          Resulting Position
        </TabButton>
        <TabButton isActive={selectedTab === "TransactionDetails"} onClick={() => setSelectedTab("TransactionDetails")}>
          Transaction Details
        </TabButton>
      </Tabs>
      {selectedTab === "TransactionDetails" && <LiquidationTransactionSummary {...item} />}
      {selectedTab === "Resulting" && <LiquidationResultingSummary {...item} />}
      <div className="text-ml flex flex-row gap-2 justify-center">
        You were liquidated
        {toCurrencyDisplay(openQuantityDelta, item.instrument.base)}
      </div>
    </>
  )
}

const LiquidationTransactionSummary: React.FC<HistoryItem> = ({
  blockTimestamp,
  openQuantityDelta,
  executionPrice,
  realisedPnL,
  instrument,
  liquidationPenalty,
  liquidationPenaltyAmount,
}) => {
  return (
    <SummaryTable>
      <SummaryRow title="Date and time">{formatDate(blockTimestamp)}</SummaryRow>
      <SummaryRow title="Quantity decrease">
        {toCurrencyDisplay(openQuantityDelta, instrument.base, {
          formatAsDelta: true,
        })}
      </SummaryRow>
      <SummaryRow title="Exit Price">{toCurrencyDisplay(absolute(executionPrice), instrument.quote)}</SummaryRow>
      <SummaryRow title="Realised PnL">
        <PnLDelta
          pnl={realisedPnL - liquidationPenaltyAmount}
          {...instrument.quote}
          testId="transaction-details-liquidation--realised-pnl"
        />
      </SummaryRow>
      <SummaryRow title={`Liquidation Penalty (${roundToTwo(Number(liquidationPenalty / 100n))}%)`}>
        <div className={getPnlColor(liquidationPenaltyAmount)}>{toCurrencyDisplay(liquidationPenaltyAmount, instrument.quote)}</div>
      </SummaryRow>
    </SummaryTable>
  )
}

const LiquidationResultingSummary: React.FC<HistoryItem> = ({
  openQuantity,
  openCost,
  previousEntryPrice,
  previousOpenQuantity,
  previousOpenCost,
  instrument,
  entryPrice,
}) => {
  return (
    <SummaryTable>
      <ResultingPositionRow
        title="Quantity"
        from={toCurrencyDisplay(previousOpenQuantity, instrument.base)}
        to={toCurrencyDisplay(openQuantity, instrument.base)}
        resultingTestId="liquidation-resulting-summary--quantity"
      />
      <ResultingPositionRow
        title="Entry Price"
        // @ts-ignore
        from={toCurrencyDisplay(previousEntryPrice, instrument.quote)}
        to={toCurrencyDisplay(entryPrice, instrument.quote)}
        resultingTestId="liquidation-resulting-summary--price"
      />
      <ResultingPositionRow
        title="Position Value"
        from={toCurrencyDisplay(previousOpenCost, instrument.quote)}
        to={toCurrencyDisplay(openCost, instrument.quote)}
        resultingTestId="liquidation-resulting-summary--value"
      />
    </SummaryTable>
  )
}
