import { NoChange } from "@/App/Positions/Position/PositionView/Shared"
import { toCurrencyDisplay } from "./CurrencyDisplay"

export const PnLDelta: React.FC<{
  pnl: bigint
  decimals: number
  displayDecimals: number
  symbol: string
  testId?: string
}> = ({ pnl, decimals, displayDecimals, symbol, testId }) => {
  if (pnl === 0n) return <NoChange testId={testId} />
  return <div className={getPnlColor(pnl)}>{toCurrencyDisplay(pnl, { decimals, displayDecimals, symbol }, { formatAsDelta: true })}</div>
}

export const getPnlColor = (pnl: bigint) => (pnl === 0n ? "" : pnl > 0n ? "text-functional-success-300" : "text-functional-error-400")
