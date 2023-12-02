import { AssetSymbol, assets } from "@/api/graphql/instruments"
import { toDisplayValue } from "@/components/CurrencyDisplay"
import { CurrencyIcon } from "@/components/CurrencyIcon"
import { Tooltip } from "@/components/Tooltip"
import { mulDiv } from "@/vivex-xyz/sdk"
import React from "react"

interface Reward {
  claimable: bigint
  usdPrice: bigint
  token: {
    symbol: string
  }
}

interface ClaimableRewardsProps {
  baseRewards: readonly Reward[]
  quoteRewards: readonly Reward[]
  testId?: string
}

export const ClaimableRewards: React.FC<ClaimableRewardsProps> = ({ baseRewards, quoteRewards, testId }) => {
  const usdRewards = [...baseRewards, ...quoteRewards].reduce(
    (acc, { usdPrice, claimable }) => acc + Number(mulDiv(claimable, usdPrice, BigInt(1e18))) / 1e18,
    0,
  )

  if (usdRewards === 0) return null

  const consolidatedRewards = [...baseRewards, ...quoteRewards].reduce((acc, { token: { symbol }, claimable, usdPrice }) => {
    const current = acc[symbol] || { claimable: 0, usdValue: 0 }

    return {
      ...acc,
      [symbol]: {
        claimable: current.claimable + Number(claimable) / 1e18,
        usdValue: current.usdValue + Number(mulDiv(claimable, usdPrice, BigInt(1e18))) / 1e18,
      },
    }
  }, {} as Record<string, { claimable: number; usdValue: number }>)

  return (
    <Tooltip
      testId="rewards-tooltip"
      message={
        <div className="flex flex-col items-center gap-1 w-fit">
          {Object.entries(consolidatedRewards)
            .sort(([, { usdValue: a }], [, { usdValue: b }]) => b - a)
            .map(([symbol, { claimable, usdValue }]) => (
              <div key={symbol} className="flex gap-2 justify-between whitespace-nowrap w-full">
                <span className="rounded-full overflow-hidden">
                  <CurrencyIcon currency={symbol} />
                </span>
                <span className="w-14">{symbol}</span>
                <span>{toDisplayValue(claimable, { ...assets[symbol as AssetSymbol], displayDecimals: 6 })}</span>
                <span>${toDisplayValue(usdValue, { decimals: 2, displayDecimals: 4 })}</span>
              </div>
            ))}
        </div>
      }
    >
      <div className="items-center py-1" data-testid={testId}>
        <span className="text-functional-success-300">+ ${toDisplayValue(usdRewards, { decimals: 2, displayDecimals: 4 })} (rewards)</span>
      </div>
    </Tooltip>
  )
}
