import { idToLogo } from "@/App/CreateTicket"
import { CurrencyIcon } from "@/components/CurrencyIcon"
import { getDisplayMoneyMarketName } from "@/vivex-xyz/sdk"
import React from "react"
import { usePositionContext } from "../Position.context"
import { unwrapId } from "../queries"
import { Side } from "@/utils/custom"

export const PositionHeader: React.FC<{
  baseSymbol: string
  quoteSymbol: string
  side: Side
  testIdPrefix: string
}> = ({ baseSymbol, quoteSymbol, side, testIdPrefix }) => {
  const colour = side === Side.Long ? "text-functional-buy-500" : "text-functional-sell-500"
  return (
    <div className="flex flex-row gap-2 px-2 py-1">
      <div className="flex-1">
        <p className="text-lg" data-testid={`${testIdPrefix}--header`}>{`${baseSymbol}/${quoteSymbol}`}</p>
        <p className={"text-sm " + colour} data-testid={`${testIdPrefix}--sub-header`}>
          {side}
        </p>
      </div>
      <div className="flex flex-row shrink">
        <CurrencyIcon width={34} height={34} currency={baseSymbol} />
        <CurrencyIcon width={34} height={34} className="-ml-[12px]" currency={quoteSymbol} />
      </div>
    </div>
  )
}

export const PositionHeaderNew: React.FC = () => {
  const position = usePositionContext()
  const { chainId, mm } = unwrapId(position.id)
  const { symbol, base, quote } = position.instrument
  return (
    <div className="flex flex-row justify-between gap-2 px-2 py-1">
      <div className="flex gap-1">
        <div className="flex flex-col">
          <span data-testid="position--title">{`${symbol}`}</span>
          <div className="flex gap-1 text-sm">
            {idToLogo(chainId)}
            {getDisplayMoneyMarketName(mm)}
          </div>
        </div>
      </div>
      <div className="flex flex-row shrink">
        <CurrencyIcon width={34} height={34} currency={base.symbol} />
        <CurrencyIcon width={34} height={34} className="-ml-[12px]" currency={quote.symbol} />
      </div>
    </div>
  )
}
