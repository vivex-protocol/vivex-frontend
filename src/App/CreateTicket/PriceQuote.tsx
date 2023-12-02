import { SupportedChainIds } from "@/api/chain"
import { CtxInstrumentId } from "@/api/graphql/instruments"
import { toDisplayValue } from "@/components/CurrencyDisplay"
import { ProtocolIcon } from "@/components/CurrencyIcon"
import { Loading } from "@/components/Loading"
import { useBearingAPR } from "@/hooks/bearingAPR"
import { classNames } from "@/utils/classNames"
import { basisRateEquivalent } from "@/utils/mappers"
import { roundToTwo } from "@/utils/rounding"
import { getDisplayMoneyMarketName } from "@/vivex-xyz/sdk"
import { Transition } from "@headlessui/react"
import { liftSuspense, state, useStateObservable } from "@react-rxjs/core"
import { Suspense, useEffect, useState } from "react"
import { combineLatest, map } from "rxjs"
import { Hex } from "viem"
import { useAccount, useSwitchNetwork } from "wagmi"
import { adjustRewardsAPR, calculateRateDifference, calculateTotalRewardRate } from "../common"
import { RatesDropdown, TICKET_RATES_KEY, ratesPreference$ } from "../common/RatesDropdown"
import { RewardRates } from "../common/RewardRates"
import { UpDownArrow } from "../common/components"
import { labelJsx, spotPriceJsx } from "../common/priceDisplay"
import { ChainAndMoneyMarketsFilter, excludedChains$, excludedMm$ } from "./Filters"
import { leverageInput$, meta$, nsPriceQuote$, onSelectPositionId, quantity$, selectedId$, selectedPair$, tradeQuotes$ } from "./state"
import { unwrapInstrumentId } from "./state/helpers"
import { arrowTestId, basisRateTestId, maturitySelectTestId, priceBreakdown } from "./testIds"
import { Side } from "@/utils/custom"

export const renderBasisRate = (basisRate: number, testId?: string) => (
  <span data-testid={testId}>{`${basisRate > 0 ? "+" : ""}${roundToTwo(basisRate)}%`}</span>
)

const MaturityOptionDropdown: React.FC<{ id: Hex; basisRate: number }> = ({ basisRate }) => {
  return (
    <div className="flex flex-col px-6 pb-3 text-sm text-fontColor-500">
      <div className="flex flex-col gap-1">
        <div className="flex gap-1 flex-col">
          <span className="text-fontColor-600">Funding rate equivalents</span>
          {(["8h", "1h"] as const).map((interval) => (
            <div key={interval} className="flex justify-between">
              <div className="flex gap-2">
                <div className="self-center rounded-full h-1 w-1 bg-blue-1" />
                {interval}
              </div>
              <span>{`${basisRateEquivalent(basisRate, 60 * 60 * 24 * 365, interval)}%`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const idToNameMap = {
  31337: "Localhost",
  31338: "Localhost",
  31339: "Localhost",
  31340: "Localhost",
  42161: "Arbitrum",
  8453: "Base",
  137: "Polygon",
  100: "Gnosis",
  10: "Optimism",
  1: "Mainnet",
} as const
export const idToLogo = (chainId: SupportedChainIds) => <ProtocolIcon protocol={idToNameMap[chainId]} />

const adjustedLeverage$ = state(
  combineLatest([selectedId$, leverageInput$]).pipe(
    map(([{ selectedSide }, leverage]) => leverage + (selectedSide === Side.Short ? 1 : 0)),
  ),
)

const MoneyMarketOption: React.FC<{ id: CtxInstrumentId }> = ({ id }) => {
  const { id: selectedId } = useStateObservable(selectedId$)
  const isSelected = selectedId === id
  const [isExpanded, setIsExpanded] = useState(false)
  const { chainId, side } = unwrapInstrumentId(id)
  const leverage = useStateObservable(adjustedLeverage$)
  const pair = useStateObservable(selectedPair$)
  const bearing = useBearingAPR(pair.base.symbol)
  const meta = useStateObservable(meta$(id))
  const rateOption = useStateObservable(ratesPreference$)[TICKET_RATES_KEY]
// @ts-ignore
  const apr = meta && meta !== "error" && calculateRateDifference(meta.rates, leverage, bearing, side, rateOption)
  const { mm } = unwrapInstrumentId(id)
  const account = useAccount()
  const walletName = account.connector?.name || ""
  const { switchNetwork } = useSwitchNetwork()

  const totalRewardRate =
    meta && meta !== "error" && calculateTotalRewardRate(meta.rewards.baseRewards, meta.rewards.quoteRewards, leverage, rateOption)
  const adjustedRewards =
    meta && meta !== "error" && adjustRewardsAPR(meta.rewards.baseRewards, meta.rewards.quoteRewards, leverage, rateOption)

  useEffect(() => {
    if (isSelected && walletName.toLowerCase().includes("rabby")) {
      switchNetwork?.(chainId)
    }
  }, [isSelected])

  return (
    <div
      className={classNames(
        "flex flex-col rounded-lg cursor-pointer",
        isSelected ? "bg-backgrounds-200" : "text-fontColor-600",
        isExpanded && !isSelected ? "bg-backgrounds-200" : "",
      )}
    >
      <div
        className={classNames("flex hover:bg-backgrounds-200 items-center px-2 justify-between h-10 rounded-lg")}
        onClick={(e) => {
          e.preventDefault()
          onSelectPositionId(id)
        }}
        data-testid={maturitySelectTestId(id)}
      >
        <span data-testid={`select-maturity--${id}`} className="flex gap-2 font-medium items-center">
          {idToLogo(chainId)}
          {`${idToNameMap[chainId]} / ${getDisplayMoneyMarketName(mm)}`}
        </span>
        <div className="flex items-center gap-2">
          {totalRewardRate && adjustedRewards && totalRewardRate > 0 ? (
            <RewardRates totalRewardRate={totalRewardRate} testId={id} rewards={adjustedRewards} />
          ) : null}
          {apr ? renderBasisRate(apr, basisRateTestId(id)) : apr === null ? <Loading size={10} /> : "Error fetching rates"}
          <UpDownArrow isExpanded={isExpanded} onClick={() => setIsExpanded((prev) => !prev)} testId={arrowTestId(id)} />
        </div>
      </div>
      {apr ? (
        <Transition show={isExpanded}>
          <MaturityOptionDropdown basisRate={apr} id={id} />
        </Transition>
      ) : null}
    </div>
  )
}

const calculateLiqPrice = (threshold: bigint, markPrice: number, leverage: number, side: Side) => {
  const leverageValue = side === Side.Short ? leverage + 1 : leverage
  const lhs = 1 - Math.pow(leverageValue, -1)
  const rhs = Number(threshold) / 1e18
  if (side === Side.Long) return markPrice * (lhs / rhs)
  else return markPrice * (rhs / lhs)
}

const spotPrice$ = state(
  combineLatest([tradeQuotes$.pipe(liftSuspense()), quantity$]).pipe(map(([data, quantity]) => spotPriceJsx(data, quantity))),
  null,
)

export const PriceBreakdown = () => {
  const {
    markPrice,
    pair,
    side,
    meta: {
      ltv: { liquidationThreshold },
    },
    fee,
  } = useStateObservable(nsPriceQuote$)
  const leverage = useStateObservable(leverageInput$)
  const liqPrice = calculateLiqPrice(liquidationThreshold, Number(markPrice) / Math.pow(10, pair.quote.decimals), leverage, side)

  return (
    <div data-testid={priceBreakdown} className={"flex flex-col gap-3 px-2 text-sm font-normal font-primary"}>
      <div className="flex justify-between">
        {labelJsx("Total Fees", "fee")}
        {toDisplayValue(fee, pair.quote, { showZero: true })}
      </div>
      <div className="flex justify-between">
        {labelJsx("Mark Price", "markPrice")}
        {toDisplayValue(markPrice, pair.quote)}
      </div>
      <div className="flex justify-between">
        {labelJsx("Liq Price", "liquidationPrice")}
        {toDisplayValue(liqPrice, pair.quote)}
      </div>
      {spotPrice$}
    </div>
  )
}

export const MoneyMarkets = () => {
  const { selectedSide, mm, chainId } = useStateObservable(selectedId$)
  const pair = useStateObservable(selectedPair$)
  const excludedMms = useStateObservable(excludedMm$)
  const excludedChains = useStateObservable(excludedChains$)

  const options = pair[selectedSide]
    .map((id) => ({ ...unwrapInstrumentId(id), id }))
    .filter(({ chainId, mm }) => !excludedChains.has(chainId) && !excludedMms.has(mm))

  useEffect(() => {
    if (excludedChains.has(chainId) || excludedMms.has(mm)) {
      if (options[0]) onSelectPositionId(options[0].id)
    }
  }, [excludedChains, excludedMms, options, chainId, mm])

  return (
    <div className={classNames("flex flex-col text-sm font-normal font-primary")}>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-fontColor-500 pl-2 py-2">
          <div className="flex gap-2 items-center">
            <span>{`Select Market`}</span>
            <ChainAndMoneyMarketsFilter />
          </div>
          <RatesDropdown storageKey={TICKET_RATES_KEY} />
        </div>
        {options.map(({ id }) => (
          <Suspense key={id}>
            <MoneyMarketOption id={id} />
          </Suspense>
        ))}
      </div>
    </div>
  )
}
