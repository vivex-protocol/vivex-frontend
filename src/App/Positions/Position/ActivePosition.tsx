import { idToLogo, renderBasisRate } from "@/App/CreateTicket"
import { onPairSelected } from "@/App/CreateTicket/state/instrument"
import { adjustRewardsAPR, calculateRateDifference, calculateTotalRewardRate } from "@/App/common"
import { ClaimableRewards } from "@/App/common/ClaimableRewards"
import { BLOTTER_RATES_KEY, RatesDropdown, ratesPreference$ } from "@/App/common/RatesDropdown"
import { RewardRates } from "@/App/common/RewardRates"
import { UpDownArrow } from "@/App/common/components"
import { SupportedChainIds } from "@/api/chain"
import { assets, availablePairs } from "@/api/graphql/instruments"
import { GraphPosition } from "@/api/graphql/queries"
import { toDisplayValue } from "@/components/CurrencyDisplay"
import { LeverageValue } from "@/components/Leverage"
import { getPnlColor } from "@/components/PnL"
import { Tooltip } from "@/components/Tooltip"
import { tooltipMapper } from "@/components/tooltipContent"
import { useBearingAPR } from "@/hooks/bearingAPR"
import { classNames } from "@/utils/classNames"
import { calculatePnlPercentage } from "@/utils/financial-utils"
import { formatDateUTC } from "@/utils/mappers"
import { roundToTwo } from "@/utils/rounding"
import { getDisplayMoneyMarketName, mulDiv } from "@/vivex-xyz/sdk"
import { useStateObservable } from "@react-rxjs/core"
import { PropsWithChildren, useState } from "react"
import { PositionActions } from "./PositionActions"
import { PositionCell, PositionRow, TableHeader } from "./PositionList"
import { getLinkedOrders$, getPositionStatus$, unwrapId } from "./queries"
import { MoneyMarket, Side } from "@/utils/custom"

export const displaySymbol = ({
  symbol,
  leverage,
  chainId,
  mm,
}: {
  mm: MoneyMarket
  chainId: SupportedChainIds
  symbol: string
  leverage?: number
}) => (
  <div className="flex gap-1 cursor-pointer" onClick={() => onPairSelected(availablePairs[symbol])}>
    <div className="flex flex-col">
      <div className="flex gap-1">
        <span data-testid="position--title">{`${symbol}`}</span>
        {leverage ? <LeverageValue testIdPrefix="position" leverage={leverage} /> : null}
      </div>
      <div className="flex gap-1">
        {idToLogo(chainId)}
        {getDisplayMoneyMarketName(mm)}
      </div>
    </div>
  </div>
)

export const ActivePositionRow: React.FC<PropsWithChildren<{ position: GraphPosition }>> = ({ position, children }) => {
  const { markPrice, liquidationPrice, leverage, equity, margin, minMargin, minEquity, closingFee, pnl, rates, rewards } =
    useStateObservable(getPositionStatus$(position.id))
  const bearingYield = useBearingAPR(position.instrument.base.symbol)

  const { chainId, mm } = unwrapId(position.id)
  const { base, quote, symbol, side } = position.instrument
  const [isExpanded, setIsExpanded] = useState(false)
  const { takeProfit, stopLoss } = useStateObservable(getLinkedOrders$(position.id))
  const rateOption = useStateObservable(ratesPreference$)[BLOTTER_RATES_KEY]

  const { sQuantity: quantity, sOpenCost: openCost } = position

  const pnlRoe = (pnl: bigint) => (
    <span className={classNames("whitespace-nowrap", getPnlColor(pnl))}>
      {`${toDisplayValue(pnl, quote, {
        formatAsDelta: true,
      })} (${Math.abs(calculatePnlPercentage(position.cashflow, pnl))}%)`}
    </span>
  )

  const actualLeverage = leverage + (side === Side.Short ? 1 : 0)
  // @ts-ignore
  const apr = calculateRateDifference(rates, actualLeverage, bearingYield, position.instrument.side, rateOption)
  const totalRewardRate = calculateTotalRewardRate(rewards.baseRewards, rewards.quoteRewards, actualLeverage, rateOption)
  const adjustedRewardRates = adjustRewardsAPR(rewards.baseRewards, rewards.quoteRewards, actualLeverage, rateOption)

  return (
    <>
      <PositionRow className="font-semibold" key={position.id + "top-key"} testId="position--active">
        <PositionCell className="pr-1 px-0 2xl:pr-2 first:pl-2">
          <UpDownArrow isExpanded={isExpanded} onClick={() => setIsExpanded((prev) => !prev)} />
        </PositionCell>
        <PositionCell className="md:sticky left-[-1px] text-left w-[140px]">
          {displaySymbol({ symbol, leverage, chainId, mm })}
        </PositionCell>
        <PositionCell testId="position--size">
          <span className={classNames(getPnlColor(quantity), "whitespace-nowrap")}>
            {`${toDisplayValue(quantity, base, { formatAsDelta: true })} ${base.symbol}`}
          </span>
        </PositionCell>
        <PositionCell testId="position--apr">
          <div className="flex flex-col gap-1">
            {renderBasisRate(apr)}
            {totalRewardRate > 0 ? (
              <RewardRates totalRewardRate={totalRewardRate} rewards={adjustedRewardRates} testId={position.id} />
            ) : null}
          </div>
        </PositionCell>
        <PositionCell testId="position--entryPrice">{toDisplayValue(position.entryPrice, quote)}</PositionCell>
        <PositionCell testId="position--liqPrice">
          <div className="flex flex-col gap-1">
            <span>{toDisplayValue(markPrice, quote)}</span>
            <span>{toDisplayValue(liquidationPrice, quote) || "-"}</span>
          </div>
        </PositionCell>
        <PositionCell>
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              <span>{toDisplayValue(equity, assets[quote.symbol])}</span>
              <span className="text-sm whitespace-nowrap text-fontColor-500">{`(${toDisplayValue(minEquity, assets[quote.symbol])})`}</span>
            </div>
            <div className="flex gap-1">
              <span>{`${roundToTwo(margin)}%`}</span>
              <span className="text-sm whitespace-nowrap text-fontColor-500">{`(${roundToTwo(minMargin)}%)`}</span>
            </div>
          </div>
        </PositionCell>
        <PositionCell testId="position--equity-pnl">
          <div className="flex flex-col gap-1">
            {pnlRoe(pnl)}
            <ClaimableRewards baseRewards={rewards.baseRewards} quoteRewards={rewards.quoteRewards} />
            {/* {pnlRoe(openCost + closingCost - position.fees - closingFee)} */}
          </div>
        </PositionCell>
        <PositionCell testId="position--realised-pnl">
          {position.realisedPnL ? (
            <span className={getPnlColor(position.realisedPnL)}>{`${toDisplayValue(position.realisedPnL, quote)} ${quote.symbol}`}</span>
          ) : (
            <span className="font-light">-</span>
          )}
        </PositionCell>
        <PositionCell className="sticky right-[35px]">
          <div className="flex flex-col gap-1">
            <span className="whitespace-nowrap">{`TP: ${
              takeProfit ? toDisplayValue(takeProfit.limitPrice, assets[quote.symbol]) : "-"
            }`}</span>
            <span className="whitespace-nowrap">{`SL: ${stopLoss ? toDisplayValue(stopLoss.limitPrice, assets[quote.symbol]) : "-"}`}</span>
          </div>
        </PositionCell>
        <PositionCell className="sticky right-[-1px] text-right">
          <PositionActions />
          {children}
        </PositionCell>
      </PositionRow>
      {!isExpanded
        ? null
        : position.lots.map((lot) => {
            const closingCost = mulDiv(markPrice, lot.quantity, base.unit)
            const closingFeeShare = mulDiv(closingFee, lot.quantity, quantity)
            // @ts-ignore
            const pnl = lot.openCost + closingCost - lot.fee - closingFeeShare
            return (
              <PositionRow className={classNames("italic text-xs", lot.quantity === 0n ? "opacity-50" : "opacity-80")} key={lot.id}>
                <PositionCell colSpan={2} className="md:sticky text-right left-[-1px] w-[140px] 2xl:pr-3 pr-1">
                  {formatDateUTC(lot.timestamp)}
                </PositionCell>
                <PositionCell>
                  <span className={classNames(getPnlColor(lot.quantity))}>
                    {`${toDisplayValue(lot.quantity, base, {
                      formatAsDelta: true,
                    })} ${base.symbol}`}
                  </span>
                </PositionCell>
                <PositionCell>-</PositionCell>
                <PositionCell>{toDisplayValue(lot.entryPrice, quote)}</PositionCell>
                <PositionCell>
                  <div className="flex flex-col gap-1">
                    <span>{toDisplayValue(markPrice, quote)}</span>
                    <span>{toDisplayValue(liquidationPrice, quote) || "-"}</span>
                  </div>
                </PositionCell>
                <PositionCell>-</PositionCell>
                <PositionCell>{pnlRoe(pnl)}</PositionCell>
                <PositionCell>
                  <span className={getPnlColor(lot.realisedPnL)}>
                    {lot.realisedPnL ? `${toDisplayValue(lot.realisedPnL, quote)} ${quote.symbol}` : "-"}
                  </span>
                </PositionCell>
                <td />
                <td />
              </PositionRow>
            )
          })}
    </>
  )
}

export const ActivePositionHeaders: React.FC<{}> = () => {
  return (
    <>
      <th className="px-0" />
      {/* <TableHeader className="text-left px-0 2xl:px-0 w-0"></TableHeader> */}
      <TableHeader className="md:sticky left-[-1px]">Symbol</TableHeader>
      <TableHeader>Size</TableHeader>
      <TableHeader>
        <RatesDropdown storageKey={BLOTTER_RATES_KEY} />
      </TableHeader>
      <TableHeader>
        <Tooltip testId="ap-tt-entry-price" message={tooltipMapper("entryPrice")}>
          Entry Price
        </Tooltip>
      </TableHeader>
      <TableHeader>
        <Tooltip
          testId="ap-tt-mark-price"
          message={
            <div className="flex flex-col gap-2">
              <span>Mark Price: {tooltipMapper("markPrice")}</span>
              <span>Liquidation Price: {tooltipMapper("liquidationPrice")}</span>
            </div>
          }
        >
          Mark/Liq. Price
        </Tooltip>
      </TableHeader>
      <TableHeader>
        <Tooltip testId="ap-tt-margin" message={tooltipMapper("margin")}>{`Margin (min)`}</Tooltip>
      </TableHeader>
      <TableHeader>
        <Tooltip testId="ap-tt-pnl" message={tooltipMapper("pnl")}>
          PnL(ROE%)
        </Tooltip>
      </TableHeader>
      <TableHeader>
        <Tooltip testId="ap-tt-rpnl" message={tooltipMapper("realisedPnl")}>
          Realised PnL
        </Tooltip>
      </TableHeader>
      <TableHeader className="sticky right-[35px]">Stops</TableHeader>
      <TableHeader className="sticky right-[-1px] text-center">
        <span className="sr-only 2xl:not-sr-only">Actions</span>
      </TableHeader>
    </>
  )
}
