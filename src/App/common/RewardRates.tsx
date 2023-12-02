import { CurrencyIcon } from "@/components/CurrencyIcon"
import { Tooltip } from "@/components/Tooltip"
import { classNames } from "@/utils/classNames"
import React from "react"

interface Reward {
  rate: number
  symbol: string
}

interface RewardRatesProps {
  rewards: Reward[]
  totalRewardRate: number
  testId: string
}

export const RewardRates: React.FC<RewardRatesProps> = ({ rewards, totalRewardRate, testId }) => {
  const sortedRewards = rewards.sort((a, b) => b.rate - a.rate)

  return (
    <Tooltip
      testId={testId}
      message={
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Trading Rewards</span>
          {sortedRewards.map(({ symbol, rate }, index) => (
            <div key={index} className="flex justify-between text-center items-center w-32">
              <CurrencyIcon className="rounded-full" currency={symbol} />
              <span className="w-14">{symbol}</span>
              <span>{rate.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      }
    >
      <div className="flex items-center py-1 w-fit px-2 gap-2 rounded-full border border-fontColor-600" data-testid={testId}>
        <span>+{totalRewardRate.toFixed(2)}%</span>
        <div style={{ minWidth: 16 + (sortedRewards.length - 1) * 12 }} className={classNames("flex -space-x-1")}>
          {sortedRewards.map(({ symbol }) => {
            return <CurrencyIcon key={symbol} currency={symbol} />
          })}
        </div>
      </div>
    </Tooltip>
  )
}
