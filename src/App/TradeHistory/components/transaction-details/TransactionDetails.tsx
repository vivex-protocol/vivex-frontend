import { PositionDialog } from "@/App/Positions/Position/PositionDialog"
import { PositionHeader } from "@/App/Positions/Position/PositionEdit/PositionHeader"
import { HistoryItem } from "@/api/graphql/positions"
import { HistoryItemType } from "@/api/zeus"
import { SecondaryButton } from "@/components/SecondaryButton"
import React from "react"
import { CloseTransactionSummary } from "./CloseTransactionSummary"
import { CreateTransactionSummary } from "./CreateTransactionSummary"
import { EditTransactionSummary } from "./EditTransactionDetails"
import { LiquidatedPositionSummary } from "./LiquidatedPositionSummary"

export const TransactionDetailsContent: React.FC<HistoryItem> = (item) => {
  switch (item.type) {
    case HistoryItemType.Modification:
      return <EditTransactionSummary {...item} />
    case HistoryItemType.Close:
      return <CloseTransactionSummary {...item} />
    case HistoryItemType.Open:
      return <CreateTransactionSummary {...item} />
    case HistoryItemType.Liquidation:
      return <LiquidatedPositionSummary {...item} />
    default:
      return null
  }
}

export const TransactionDetails: React.FC<{
  item: HistoryItem
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}> = ({ isOpen, setIsOpen, item }) => {
  return (
    <PositionDialog isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <div className="bg-backgrounds-100 border-backgrounds-300 border rounded-lg inline-block w-full">
        <div className="font-primary rounded-lg m-4 max-w-[350px] flex flex-col gap-3">
          <PositionHeader
            baseSymbol={item.instrument.base.symbol}
            quoteSymbol={item.instrument.quote.symbol}
            // @ts-ignore
            side={item.instrument.side}
            testIdPrefix="transaction-details--header"
          />
          <div data-testid="transaction-details--content">
            <TransactionDetailsContent {...item} />
          </div>
          <SecondaryButton onClick={() => setIsOpen(false)} testId="transaction-details--close-button">
            Close
          </SecondaryButton>
        </div>
      </div>
    </PositionDialog>
  )
}
