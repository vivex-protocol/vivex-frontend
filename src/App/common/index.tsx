import { Asset, Pair } from "../../api/graphql/instruments"
import { OrderType } from "../../api/graphql/queries"
import { toDisplayValue } from "../../components/CurrencyDisplay"
import { roundToTwo } from "../../utils/rounding"
import {
  CashflowCurrency,
  calculateLeverage,
  calculateMarkPrice,
  max,
  min,
  mulDiv,
  positionStatusPure,
} from "../../sdk/dist/contango-sdk.js"

import { QuoteSwapReturnType, QuoteTradeParams, Side, TradeQuote } from "../../utils/custom"
import { Hex } from "viem"

type PartialPair = Pick<Pair, "quote" | "base">

const mapToResultingPosition = (quoteTradeResponse: TradeQuote, side: Side, pair: PartialPair) => {
  // @ts-ignore
  const { meta, newCollateral, newDebt } = quoteTradeResponse
  const { normalisedBalances } = meta
  const mergedMeta = {
    ...meta,
    normalisedBalances: {
      // @ts-ignore
      ...normalisedBalances,
      collateral: newCollateral,
      debt: newDebt,
    },
  }

  const status = positionStatusPure(mergedMeta, side)

  const value = toDisplayValue(status.value, pair.quote)
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

export const calculateAPR = (rates: { borrowingRate: bigint; lendingRate: bigint }, leverage: number, bearingAPR: bigint, side: Side) => {
  try {
    const lendingRate = rates.lendingRate + (side === Side.Long ? bearingAPR : 0n)
    const borrowingRate = rates.borrowingRate + (side === Side.Short ? bearingAPR : 0n)
    const debtRatio = BigInt(1e18 - Math.floor(Math.pow(leverage, -1) * 1e18))
    // @ts-ignore
    const bRate = lendingRate - mulDiv(borrowingRate, debtRatio, BigInt(1e18))
    return Number(bRate) / 1e16
  } catch {
    return 0
  }
}

export const mapTradeResponse = (quoteTradeResponse: TradeQuote, side: Side, pair: PartialPair) => {
  const isShort = side === Side.Short
  // @ts-ignore
  const markPrice = calculateMarkPrice(quoteTradeResponse.meta, isShort)
  // @ts-ignore
  const { meta, debtDelta, newCollateral, maxDebt } = quoteTradeResponse
  const {
    // @ts-ignore
    liquidity,
    // @ts-ignore
    normalisedBalances: { unit },
  } = meta

  const offset = isShort ? 1 : 0
// @ts-ignore
  const maxLeverage = 1e18 / (1e18 - Number(meta.ltv.ltv)) - offset
  const upperBound = calculateUpperBound({ collateral: newCollateral, debt: maxDebt, unit }) - offset

  const maxQuantity = isShort ? liquidity.borrowingLiquidity : liquidity.lendingLiquidity

  // @ts-ignore
  let quantity = quoteTradeResponse.tradeQuantity
  // @ts-ignore
  let fee = quoteTradeResponse.fee
  if (side === Side.Short) {
    // @ts-ignore
    quantity = mulDiv(debtDelta, meta.prices.unit, meta.prices.debt)
    // @ts-ignore
    quantity = mulDiv(quantity, meta.instrument.quoteUnit, meta.normalisedBalances.unit)
  } else {
    // @ts-ignore
    fee = mulDiv(quoteTradeResponse.normalisedFee, meta.prices.unit, meta.prices.debt)
    // @ts-ignore
    fee = mulDiv(fee, meta.instrument.quoteUnit, meta.normalisedBalances.unit)
  }

  const resultingPosition = mapToResultingPosition(quoteTradeResponse, side, pair)

  return {
    ...quoteTradeResponse,
    markPrice,
    fee,
    quantity,
    side,
    maxQuantity,
    resultingPosition,
    pair,
    upperBound,
    maxLeverage,
  }
}

export type TradeQuoteMapped = ReturnType<typeof mapTradeResponse>

export const mapQuoteSwapResponse = (_trades: QuoteSwapReturnType, quote: TradeQuoteMapped) => {
  let trades = _trades
  const {
    meta: {
      // @ts-ignore
      instrument: { quoteUnit, baseUnit },
    },
  } = quote
  if (quote.side === Side.Short) {
    // @ts-ignore
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
  excludedFlashloanProviders?: Set<Hex>,
): QuoteTradeParams => {
  const cashflowCcy = CashflowCurrency.Quote
  const slippageTolerance = BigInt(0.005e18)
  const quantity = _quantity || 0n
  if (leverage === null) {
    return {
      // @ts-ignore
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
      // @ts-ignore
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
