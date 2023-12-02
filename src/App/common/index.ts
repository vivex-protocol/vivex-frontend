import { SupportedChainIds } from "@/api/chain"
import { Asset, Pair } from "@/api/graphql/instruments"
import { OrderType } from "@/api/graphql/queries"
import { toDisplayValue } from "@/components/CurrencyDisplay"
import { roundToTwo } from "@/utils/rounding"
import {
  CashflowCurrency,
  // @ts-ignore
  QuoteSwapReturnType,
  // @ts-ignore
  QuoteTradeParams,
  // @ts-ignore
  TradeQuote,
  absolute,
  calculateLeverage,
  calculateMarkPrice,
  max,
  min,
  mulDiv,
  positionStatusPure,
} from "@/vivex-xyz/sdk"
import { Side } from "@/utils/custom"
import { Hex } from "viem"

type PartialPair = Pick<Pair, "quote" | "base">

const mapToResultingPosition = (quoteTradeResponse: TradeQuote, side: Side, pair: PartialPair) => {
  const { meta, newCollateral, newDebt } = quoteTradeResponse
  const { normalisedBalances } = meta
  const mergedMeta = {
    ...meta,
    normalisedBalances: {
      ...normalisedBalances,
      collateral: newCollateral,
      debt: newDebt,
    },
  }

  const status = positionStatusPure(mergedMeta, side)

  const value = toDisplayValue(status.value, pair.quote, { showZero: true })
  const leverage = roundToTwo(Number(status.leverage) / 1e8)
  const margin = roundToTwo(Number(status.margin) / 1e6)

  return {
    value,
    leverage,
    margin,
    liquidationPrice: status.liquidationPrice,
    status,
  }
}
export type RateOptions = "APR" | "ROE"

export const calculateRateDifference = (
  rates: { borrowingRate: bigint; lendingRate: bigint },
  leverage: number,
  bearingAPR: bigint,
  side: Side,
  rateOption: RateOptions = "APR",
) => {
  try {
    const lendingRate = rates.lendingRate + (side === Side.Long ? bearingAPR : 0n)
    const borrowingRate = rates.borrowingRate + (side === Side.Short ? bearingAPR : 0n)
    const debtRatio = BigInt(1e18 - Math.floor(Math.pow(leverage, -1) * 1e18))
    // @ts-ignore
    const bRate = lendingRate - mulDiv(borrowingRate, debtRatio, BigInt(1e18))
    const apr = Number(bRate) / 1e16
    switch (rateOption) {
      case "APR":
        return apr
      case "ROE":
        return apr * leverage
    }
  } catch {
    return 0
  }
}

type APRs = readonly { rate: bigint }[]
export const calculateTotalRewardRate = (baseAprs: APRs, quoteAprs: APRs, leverage: number, rateOption: RateOptions = "APR") => {
  try {
    const lendingRate = baseAprs.reduce((acc, { rate }) => acc + rate, 0n)
    const borrowingRate = quoteAprs.reduce((acc, { rate }) => acc + rate, 0n)
    const debtRatio = BigInt(1e18 - Math.floor(Math.pow(leverage, -1) * 1e18))
    // @ts-ignore
    const bRate = lendingRate + mulDiv(borrowingRate, debtRatio, BigInt(1e18))
    const rewardRate = Number(bRate) / 1e16
    switch (rateOption) {
      case "APR":
        return rewardRate
      case "ROE":
        return rewardRate * leverage
    }
  } catch {
    return 0
  }
}

type Rewards = readonly { token: { symbol: string }; rate: bigint }[]
export const adjustRewardsAPR = (baseAprs: Rewards, quoteAprs: Rewards, leverage: number, rateOption: RateOptions = "APR") => {
  try {
    const debtRatio = BigInt(1e18 - Math.floor(Math.pow(leverage, -1) * 1e18))
    const allAssets = new Set([...baseAprs, ...quoteAprs].map((reward) => reward.token.symbol))

    return Array.from(allAssets).map((symbol) => {
      const lendingRate = baseAprs.find((reward) => reward.token.symbol === symbol)?.rate ?? 0n
      const borrowingRate = quoteAprs.find((reward) => reward.token.symbol === symbol)?.rate ?? 0n
// @ts-ignore
      const adjustedRate = lendingRate + mulDiv(borrowingRate, debtRatio, BigInt(1e18))

      const rate = (Number(adjustedRate) / 1e16) * (rateOption === "ROE" ? leverage : 1)

      return { symbol, rate }
    })
  } catch {
    return []
  }
}

export const mapTradeResponse = (quoteTradeResponse: TradeQuote, side: Side, pair: PartialPair, chainId: SupportedChainIds) => {
  const isShort = side === Side.Short
  const markPrice = calculateMarkPrice(quoteTradeResponse.meta, isShort)
  const { meta, debtDelta, newCollateral, maxDebt } = quoteTradeResponse
  const {
    liquidity,
    normalisedBalances: { unit },
  } = meta

  const offset = isShort ? 1 : 0

  const maxLeverage = 1e18 / (1e18 - Number(meta.ltv.ltv)) - offset
  const upperBound = calculateUpperBound({ collateral: newCollateral, debt: maxDebt, unit }) - offset

  const maxQuantity = isShort ? liquidity.borrowingLiquidity : liquidity.lendingLiquidity

  let quantity = quoteTradeResponse.tradeQuantity
  let fee = quoteTradeResponse.fee
  if (side === Side.Short) {
    quantity = mulDiv(debtDelta, meta.prices.unit, meta.prices.debt)
    quantity = mulDiv(quantity, meta.instrument.quote.unit, meta.normalisedBalances.unit)
  } else {
    fee = mulDiv(quoteTradeResponse.normalisedFee, meta.prices.unit, meta.prices.debt)
    fee = mulDiv(fee, meta.instrument.quote.unit, meta.normalisedBalances.unit)
  }

  const resultingPosition = mapToResultingPosition(quoteTradeResponse, side, pair)

  return {
    ...quoteTradeResponse,
    cashflowSymbol: quoteTradeResponse.params.params.cashflowCcy === CashflowCurrency.Base ? pair.base.symbol : pair.quote.symbol,
    markPrice,
    fee,
    quantity,
    side,
    maxQuantity,
    resultingPosition,
    pair,
    upperBound,
    maxLeverage,
    chainId,
  }
}

export type TradeQuoteMapped = ReturnType<typeof mapTradeResponse>

export const mapQuoteSwapResponse = (_trades: QuoteSwapReturnType, quote: TradeQuoteMapped) => {
  let trades = _trades
  const {
    meta: {
      instrument: {
        base: { unit: baseUnit },
        quote: { unit: quoteUnit },
      },
    },
  } = quote
  if (quote.side === Side.Short) {
    trades = trades.map((trade) => {
      let price = mulDiv(quoteUnit, quoteUnit, trade.price)
      price = mulDiv(price, baseUnit, quoteUnit)
      return { ...trade, price }
    })
  }
  const tradesWithCost = trades.map((trade) => {
    const cost = mulDiv(quote.quantity, trade.price, 10n ** BigInt(quote.pair.base.decimals))
    return { ...trade, cost }
  })
  return { trades: tradesWithCost, quote }
}

export type QuoteSwapMapped = ReturnType<typeof mapQuoteSwapResponse>

export const getTradeParams = (
  _quantity: bigint | null,
  side: Side,
  leverage: number | null,
  // @ts-ignore
  cashflowCcy: CashflowCurrency.Base | CashflowCurrency.Quote,
  excludedFlashloanProviders?: Set<Hex>,
): QuoteTradeParams => {
  const slippageTolerance = BigInt(0.005e18)
  const quantity = _quantity || 0n
  if (leverage === null) {
    return {
      type: "2",
      params: {
        side,
        quantity,
        cashflow: 0n,
        cashflowCcy,
        slippageTolerance,
        excludedFlashloanProviders,
      },
    }
  } else {
    return {
      type: "1",
      params: {
        side,
        quantity,
        leverage: BigInt(Math.floor(leverage * 1e8)),
        slippageTolerance,
        cashflowCcy,
        excludedFlashloanProviders,
      },
    }
  }
}

export const calculateUpperBound = ({ collateral, debt, unit }: { collateral: bigint; debt: bigint; unit: bigint }) => {
  if (collateral && debt) {
    const maxLeverage = calculateLeverage({
      collateral,
      debt,
      unit,
    })
    return Number(maxLeverage) / 1e8
  }
  return 100
}

export const estimatePnl = (
  sQuantity: bigint,
  inputValue: bigint | null,
  markPrice: bigint,
  base: Asset,
  entryPrice: bigint,
  orderType: OrderType,
) => {
  if (!inputValue) return { abs: 0n, percentage: 0, crosses: "" }
  const baseUnit = 10n ** BigInt(base.decimals)

  let crosses = ""

  if (sQuantity > 0n) {
    if (orderType === OrderType.TakeProfit) {
      if (inputValue < markPrice) crosses = "below"
    }
    if (orderType === OrderType.StopLoss) {
      if (inputValue > markPrice) crosses = "above"
    }
  }

  if (sQuantity < 0n) {
    if (orderType === OrderType.TakeProfit) {
      if (inputValue > markPrice) crosses = "above"
    }
    if (orderType === OrderType.StopLoss) {
      if (inputValue < markPrice) crosses = "below"
    }
  }

  const diff = inputValue - entryPrice
  let abs = mulDiv(diff, sQuantity, baseUnit)
  console.log("abs", abs, orderType === OrderType.TakeProfit ? "TakeProfit" : "StopLoss")
  const div = sQuantity < 0n ? Number(markPrice) / Number(inputValue) : Number(inputValue) / Number(markPrice)
  let percentage = (div - 1) * 100

  if (orderType === OrderType.StopLoss) {
    percentage *= -1
    abs = min(0n, abs)
  } else {
    abs = max(0n, abs)
  }

  const c = percentage < 0 ? (markPrice < inputValue ? "above" : "below") : ""
  percentage = Math.max(0, percentage)

  return { abs, percentage, crosses }
}

export const isAboveMinQty = (quantity: bigint | null, baseAsset: Asset) => {
  const baseUnit = 10n ** BigInt(baseAsset.decimals)
  const min = baseUnit / 10n ** BigInt(baseAsset.displayDecimals)
  return quantity ? absolute(quantity) >= min : true
}
