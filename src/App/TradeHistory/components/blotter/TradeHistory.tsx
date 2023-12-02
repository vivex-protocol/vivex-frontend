import { displaySymbol } from "@/App/Positions/Position/ActivePosition"
import { usePositionAccount } from "@/App/Positions/Position/Position.context"
import { PositionCell, PositionRow, TableHeader } from "@/App/Positions/Position/PositionList"
import { NoChange } from "@/App/Positions/Position/PositionView/Shared"
import { unwrapId } from "@/App/Positions/Position/queries"
import { HistoryItemType } from "@/api/zeus"
import { Countdown } from "@/components/Countdown"
import { toCurrencyDisplay, toDisplayValue } from "@/components/CurrencyDisplay"
import { Label } from "@/components/Label"
import { getPnlColor } from "@/components/PnL"
import { Tooltip } from "@/components/Tooltip"
import { withPrefix } from "@/utils/test-utils"
import { useStateObservable } from "@react-rxjs/core"
import React from "react"
import { transactionHistory$ } from "../../state"
import { TransactionMenu } from "../action-menu/TransactionMenu"

const testIdPrefix = "transaction-history-item"

function typeToLabel(type: HistoryItemType) {
  switch (type) {
    case HistoryItemType.Open:
      return "Opened"
    case HistoryItemType.Close:
      return "Closed"
    case HistoryItemType.Liquidation:
      return "Liquidated"
    case HistoryItemType.Modification:
      return "Modified"
    case HistoryItemType.Delivery:
      return "Delivered"
  }
}

export const TransactionHistoryHeaders: React.FC<{}> = () => {
  return (
    <>
      <TableHeader className="md:sticky left-[-1px] text-left">ID</TableHeader>
      <TableHeader className="text-left">Instrument</TableHeader>
      <TableHeader className="text-left">Time</TableHeader>
      <TableHeader className="text-center">Type</TableHeader>
      <TableHeader>Quantity</TableHeader>
      <TableHeader>Cashflow</TableHeader>
      <TableHeader>Realised PnL</TableHeader>
      <TableHeader>Execution price</TableHeader>
      <TableHeader>Fees</TableHeader>
      <TableHeader className="sticky right-[-1px] text-center">
        <span className="sr-only 2xl:not-sr-only">Actions</span>
      </TableHeader>
    </>
  )
}

export const TransactionHistoryTable: React.FC = () => {
  const account = usePositionAccount()
  const historyItems = useStateObservable(transactionHistory$(account))

  if (!historyItems) {
    return <LoadErrorMessage />
  }
  return (
    <>
      {historyItems.length === 0 ? (
        <NoHistoryItemsMessage />
      ) : (
        historyItems.map((item) => {
          const { instrument, chainId, openQuantityDelta } = item
          const { symbol } = instrument
          const { mm } = unwrapId(item.positionId)
          return (
            <PositionRow key={item.id.toString()} testId={item.id.toString()}>
              <PositionCell className="md:sticky left-[-1px] text-left">
                <span className="flex gap-1" data-testid={withPrefix("id", testIdPrefix)}>
                  {"#" + item.positionNumber}
                </span>
              </PositionCell>
              <PositionCell className="text-left">{displaySymbol({ symbol, chainId, mm })}</PositionCell>
              <PositionCell className="text-left" testId={withPrefix("time", testIdPrefix)}>
                <TransactionTime transactionTimestamp={Number(item.blockTimestamp)} />
              </PositionCell>
              <PositionCell className="text-center">
                <Label testId={withPrefix("action", testIdPrefix)} label={typeToLabel(item.type)} />
              </PositionCell>
              <PositionCell className={getPnlColor(openQuantityDelta)}>
                {toCurrencyDisplay(openQuantityDelta, instrument.base, { formatAsDelta: true })}
              </PositionCell>
              <PositionCell>
                {toCurrencyDisplay(item.cashflow.value, item.cashflow.ccy, {
                  formatAsDelta: true,
                })}
              </PositionCell>
              <PositionCell>
                <span className="flex gap-1 whitespace-nowrap">
                  <span className={getPnlColor(item.realisedPnL)}>
                    {toDisplayValue(item.realisedPnL, instrument.quote, {
                      formatAsDelta: true,
                    })}
                  </span>
                  <span className="text-fontColor-500">{item.realisedPnL ? instrument.quote.symbol : "-"}</span>
                </span>
              </PositionCell>
              <PositionCell testId={withPrefix("executionPrice", testIdPrefix)}>
                {
                  item.executionPrice === 0n ? <NoChange /> : 
                  // @ts-ignore
                  toCurrencyDisplay(item.executionPrice, item.instrument.quote)
                }
              </PositionCell>
              <PositionCell testId={withPrefix("fee", testIdPrefix)}>
                {toCurrencyDisplay(item.fee + item.executionFee, item.instrument.quote)}
              </PositionCell>
              <PositionCell className="sticky right-[-1px] text-right" testId={withPrefix("menu", testIdPrefix)}>
                <TransactionMenu item={item} />
              </PositionCell>
            </PositionRow>
          )
        })
      )}
    </>
  )
}

export const TransactionTime: React.FC<{ transactionTimestamp: number }> = ({ transactionTimestamp }) => {
  return (
    <Tooltip testId="tt-th-transaction-time" message={new Date(transactionTimestamp * 1000).toLocaleString()}>
      <Countdown startTimestamp={transactionTimestamp} endTimestamp={Date.now() / 1000} />
    </Tooltip>
  )
}

const NoHistoryItemsMessage: React.FC = () => {
  return (
    <PositionRow>
      <td data-testid="no-trades-message" className="absolute whitespace-nowrap pl-4 py-3 font-primary text-left">
        No transaction history to show
      </td>
    </PositionRow>
  )
}

const LoadErrorMessage: React.FC = () => {
  return (
    <PositionRow>
      <td data-testid="trade-history-load-error" className="absolute whitespace-nowrap pl-4 py-3 font-primary text-left">
        Failed to load transaction history. Please try again later.
      </td>
    </PositionRow>
  )
}
