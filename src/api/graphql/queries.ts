import { CtxPositionId } from "@/App/Positions/Position/queries"
import { ReturnPromiseType } from "@/utils/types"
import { MoneyMarket, Side, absolute, getMoneyMarketName, mulDiv } from "@/vivex-xyz/sdk"
import { Hex } from "viem"
import { SupportedChainIds } from "../chain"
import {
  Chain,
  Currency,
  OrderType as GOrderType,
  HistoryItem_orderBy,
  OrderDirection,
  Position_orderBy,
  MoneyMarket as ZeusMoneyMarket,
  _SubgraphErrorPolicy_,
} from "../zeus"
import { AssetSymbol, assets, availablePairs, shortIdsSet } from "./instruments"
import { metaQuery, positionQuery } from "./querySelectors"
import { decimalToBigint, scalars } from "./scalars"

export const formatId = (positionId: string, chainId: SupportedChainIds, owner: string): CtxPositionId => {
  return `${positionId.toLocaleLowerCase() as Hex}-${chainId}-${owner.toLocaleLowerCase() as Hex}`
}

async function queryAll<T extends { _meta?: { block: { number: number } } }>(chains: string[], query: (chain: string) => Promise<T>) {
  const results = await Promise.allSettled(chains.map((chain) => query(chain)))

  const res = results
    .map((result, idx) => ({ chain: chains[idx], result }))
    .filter(({ result }) => result.status === "fulfilled")
    .map(({ chain, result }) => ({ result: (result as PromiseFulfilledResult<T>).value, chain }))
    .sort(({ result: { _meta: meta1 } }, { result: { _meta: meta2 } }) => meta1!.block.number - meta2!.block.number) // Sort descending by block number
    .pop()

  console.log("queryAll", res?.chain, res?.result._meta?.block.number)

  return res
}

export const queryLatestBlockNo = async (chains: string[]) => {
  const query = (chain: string) =>
    Chain(chain)("query", { scalars })({
      _meta: [{}, metaQuery],
    })

  const response = await queryAll(chains, query)

  // TODO should we blow here instead?
  if (!response) {
    console.error("No results from any graph [latest block]")
    return { chain: "", block: 0n }
  }

  return { chain: response.chain, block: BigInt(response.result._meta?.block.number || 0) }
}

// This is just a hack to infer a type. this fn is not used anywhere
const _positionType = async () => {
  const chain = Chain("https://api.thegraph.com/subgraphs/name/contango-xyz/contango-v2")
  const { positions } = await chain("query", { scalars })({
    positions: [{ subgraphError: _SubgraphErrorPolicy_.allow }, positionQuery],
  })
  return positions[0]
}

type GPosition = ReturnPromiseType<typeof _positionType>
type GHistoryItem = GPosition["history"][0]

const getDisplayDecimalsForAsset = (symbol: string) => {
  const asset = assets[symbol as AssetSymbol]
  if (asset) return asset.displayDecimals
  console.error("Missing display decimals configuration for asset", symbol)
  return 2
}

const transformAsset = (asset: GPosition["instrument"]["base"]) => {
  let symbol = asset.symbol

  if (symbol === "WETH") symbol = "ETH"
  if (symbol === "WMATIC") symbol = "MATIC"
  if (symbol === "WXDAI") symbol = "DAI"
  // Arbitrum
  if (asset.id.toLowerCase() === "0xaf88d065e77c8cC2239327C5EDb3A432268e5831".toLowerCase()) symbol = "USDC"
  if (asset.id.toLowerCase() === "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8".toLowerCase()) symbol = "USDC.e"
  // Optimism
  if (asset.id.toLowerCase() === "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85".toLowerCase()) symbol = "USDC"
  if (asset.id.toLowerCase() === "0x7F5c764cBc14f9669B88837ca1490cCa17c31607".toLowerCase()) symbol = "USDC.e"

  const unit = BigInt(10 ** asset.decimals)
  const displayDecimals = getDisplayDecimalsForAsset(symbol)

  return { ...asset, symbol: symbol as AssetSymbol, unit, displayDecimals }
}

export type Asset = ReturnType<typeof transformAsset>

const getDisplayDecimalsForInstrument = (instrumentSymbol: string) => {
  const pair = availablePairs[instrumentSymbol]
  if (pair) return pair.quote.displayDecimals
  console.error("Missing display decimals configuration for instrument", instrumentSymbol)
  return 2
}

const transformInstrument = (instrument: GPosition["instrument"]) => {
  const isShort = shortIdsSet.has(instrument.id)
  const side = isShort ? Side.Short : Side.Long

  const assets = isShort ? [instrument.quote, instrument.base] : [instrument.base, instrument.quote]
  const [base, quote] = assets.map(transformAsset)

  const symbol = `${base.symbol}/${quote.symbol}`
  const displayDecimals = getDisplayDecimalsForInstrument(symbol)

  return {
    base,
    quote: { ...quote, displayDecimals },
    side,
    symbol,
    displayDecimals,
  }
}

export type Instrument = ReturnType<typeof transformInstrument>

const transformFillItem = (item: GHistoryItem, rawInstrument: GPosition["instrument"], instrument: Instrument) => {
  const timestamp = Number(item.blockTimestamp)
  const isShort = instrument.side === Side.Short

  const fillCost = decimalToBigint(isShort ? item.fillSize : item.fillCost, instrument.quote.decimals)
  const fillSize = decimalToBigint(isShort ? item.fillCost : item.fillSize, instrument.base.decimals)

  return instrument.side === Side.Short
    ? {
        id: item.id,
        timestamp,
        fillCost: fillCost - decimalToBigint(item.equityBase, instrument.quote.decimals),
        fillSize: fillSize + decimalToBigint(item.equityQuote, instrument.base.decimals),
        fee: decimalToBigint(item.feeBase, rawInstrument.base.decimals),
      }
    : {
        id: item.id,
        timestamp,
        fillCost,
        fillSize,
        fee: decimalToBigint(item.feeQuote, rawInstrument.quote.decimals),
      }
}

export type FillItem = ReturnType<typeof transformFillItem>

const transformFillsToLots = (fills: FillItem[], instrument: Instrument) => {
  const sortedFills = fills.sort((a, b) => a.timestamp - b.timestamp) // oldest first
  const isLot = (fillSize: bigint) => absolute(sortedFills[0].fillSize + fillSize) > absolute(sortedFills[0].fillSize)
  const lots = sortedFills.filter((fill) => isLot(fill.fillSize)).map((lot, idx) => ({ ...lot, lotNumber: idx + 1, realisedPnL: 0n }))
  const closingFills = sortedFills.filter(({ fillSize }) => fillSize && !isLot(fillSize))

  for (let { fillSize, fillCost, fee } of closingFills) {
    let remainingFillSize = fillSize
    let remainingFillCost = fillCost
    let remainingFee = fee

    for (let i = 0; i < lots.length; i++) {
      const lot = lots[i]
      const lotSize = lot.fillSize
      const lotCost = lot.fillCost

      if (absolute(lotSize) > absolute(remainingFillSize)) {
        const closedCost = (remainingFillSize * lotCost) / lotSize
        const realisedPnL = absolute(remainingFillCost) - absolute(closedCost)
        lot.fee += remainingFee
        lot.fillSize += remainingFillSize
        lot.fillCost += closedCost
        // @ts-ignore
        lot.realisedPnL += realisedPnL
        remainingFillSize = 0n
        remainingFillCost = 0n
        remainingFee = 0n
        break
      } else {
        const shareOfClosingCost = (lotSize * remainingFillCost) / remainingFillSize
        const shareOfFee = absolute((lotSize * remainingFee) / remainingFillSize)
        const realisedPnL = absolute(shareOfClosingCost) - absolute(lotCost)
        lot.fee += shareOfFee
        lot.fillSize = 0n
        lot.fillCost = 0n
        // @ts-ignore
        lot.realisedPnL += realisedPnL
        remainingFillSize += lotSize
        remainingFillCost += shareOfClosingCost
        remainingFee -= shareOfFee
        // when fully closing a lot, we roll the realised PnL into the next lot, with the fee settled
        const nextLot = lots[i + 1]
        if (nextLot) {
          nextLot.realisedPnL += lot.realisedPnL - lot.fee
          lot.fee = 0n
          lot.realisedPnL = 0n
        }
      }
    }
  }

  const baseUnit = BigInt(Math.pow(10, instrument.base.decimals))
  return (
    lots
      // .filter((lot) => lot.fillSize !== 0n)
      .map(({ fillCost, fillSize, ...rest }) => {
        const entryPrice = absolute(mulDiv(fillCost, baseUnit, fillSize))
        return { quantity: fillSize, openCost: fillCost, entryPrice, ...rest }
      })
      .sort((a, b) => b.lotNumber - a.lotNumber)
  )
}

export type Lot = ReturnType<typeof transformFillsToLots>[0]

export enum OrderType {
  Limit,
  TakeProfit,
  StopLoss,
}

const mapOrderTypeEnum = (type: GOrderType): OrderType => {
  switch (type) {
    case GOrderType.Limit:
      return OrderType.Limit
    case GOrderType.TakeProfit:
      return OrderType.TakeProfit
    case GOrderType.StopLoss:
      return OrderType.StopLoss
  }
}

export const invertLimitPrice = (value: bigint, { quote, base, side }: Instrument) => {
  if (side === Side.Short) return mulDiv(base.unit, quote.unit, value)
  return value
}

const transformPosition = (position: GPosition) => {
  const instrument = transformInstrument(position.instrument)

  const quote = {
    cashflow: position.cashflowQuote,
    equity: position.equityQuote,
    fees: position.feesQuote,
    realisedPnL: position.realisedPnLQuote,
    quantity: position.quantity,
    openCost: position.openCost,
  }
  const base = {
    cashflow: position.cashflowBase,
    equity: position.equityBase,
    fees: position.feesBase,
    realisedPnL: position.realisedPnLBase,
    quantity: position.openCost,
    openCost: position.quantity,
  }
  const values = instrument.side === Side.Short ? base : quote
  const cashflow = decimalToBigint(values.cashflow, instrument.quote.decimals)
  const equity = decimalToBigint(values.equity, instrument.quote.decimals)

  const historyItems = position.history.map((item) => transformFillItem(item, position.instrument, instrument))

  const orders = position.orders.map((order) => {
    return {
      type: mapOrderTypeEnum(order.type),
      orderId: order.id as Hex,
      limitPrice: invertLimitPrice(BigInt(order.limitPrice), instrument),
    }
  })

  const isClosed = values.quantity === "0"

  const lots = transformFillsToLots(historyItems, instrument)

  const {
    openCost: sOpenCost,
    quantity: sQuantity,
    realisedPnL,
    fees,
  } = lots.reduce(
    (acc, curr) => ({
      fees: acc.fees + curr.fee,
      openCost: acc.openCost + curr.openCost,
      quantity: acc.quantity + curr.quantity,
      realisedPnL: acc.realisedPnL + curr.realisedPnL,
    }),
    { openCost: 0n, quantity: 0n, realisedPnL: 0n, fees: 0n },
  )
  const entryPrice = absolute(mulDiv(sOpenCost, instrument.base.unit, sQuantity))

  return {
    quantity: absolute(sQuantity),
    sQuantity,
    cashflow,
    equity,
    fees,
    realisedPnL: realisedPnL * (instrument.side === Side.Short ? -1n : 1n),
    openCost: absolute(sOpenCost),
    sOpenCost,
    entryPrice,
    instrument,
    historyItems,
    lots,
    isClosed,
    orders,
    creationBlockTimestamp: Number(position.creationBlockTimestamp), // Unix timestamp
    owner: position.owner.id as Hex,
  }
}

export const queryPositions = async (chains: string[], owner: string, chainId: SupportedChainIds) => {
  const query = (chain: string) =>
    Chain(chain)("query", { scalars })({
      _meta: [{}, metaQuery],
      positions: [
        {
          where: { owner: owner.toLowerCase(), quantity_gt: 0 },
          subgraphError: _SubgraphErrorPolicy_.allow,
          orderBy: Position_orderBy.number,
          orderDirection: OrderDirection.desc,
        },
        positionQuery,
      ],
    })

  const res = await queryAll(chains, query)

  // TODO should we blow here instead?
  if (!res) {
    console.error("No results from any graph [positions]")
    return []
  }

  return res.result.positions.map((position) => {
    const mappedResponse = transformPosition(position)
    const id = formatId(position.id, chainId, position.owner.id)

    return {
      id,
      status: "inSync" as PositionStatus,
      ...mappedResponse,
    }
  })
}
// @ts-ignore
export const queryClaimableRewards = async (chains: string[], owner: string, mms: MoneyMarket[]) => {
  if (!owner) return []
  try {
    const query = (chain: string) =>
      Chain(chain)("query", { scalars })({
        _meta: [{}, metaQuery],
        positions: [
          {
            where: { owner: owner.toLowerCase(), claimableRewards: true, moneyMarket_in: mms.map(getMoneyMarketName) as ZeusMoneyMarket[] },
            subgraphError: _SubgraphErrorPolicy_.allow,
          },
          {
            id: true,
            owner: { id: true },
          },
        ],
      })

    const res = await queryAll(chains, query)

    if (!res) return []

    return res.result.positions.map((position) => position.id.toLowerCase() as Hex)
  } catch (e) {
    return []
  }
}

export type PositionStatus = "inSync" | "pendingIndex"

export type GraphPosition = ReturnPromiseType<typeof queryPositions>[0]

export const queryHistoryItems = async (
  chains: string[],
  _filters: Partial<{ trader: string; positionId: string }>,
  chainId: SupportedChainIds,
) => {
  const byOwner = _filters.trader ? { owner: _filters.trader.toLowerCase() } : { owner: "" }
  const byId = _filters.positionId ? { position_: { number: _filters.positionId } } : {}

  const where = { ...byOwner, ...byId }

  const query = (chain: string) =>
    Chain(chain)("query", { scalars })({
      _meta: [{}, metaQuery],
      historyItems: [
        {
          where,
          subgraphError: _SubgraphErrorPolicy_.allow,
          orderBy: HistoryItem_orderBy.blockNumber,
          orderDirection: OrderDirection.desc,
        },
        {
          id: true,
          type: true,
          fillSize: true,
          fillCost: true,
          fillPrice: true,
          cashflowCcy: true,
          cashflowBase: true,
          cashflowQuote: true,
          equityBase: true,
          equityQuote: true,
          openQuantity: true,
          openCost: true,
          closedCost: true,
          cashflowBaseAcc: true,
          cashflowQuoteAcc: true,
          equityBaseAcc: true,
          equityQuoteAcc: true,
          feeCcy: true,
          feeBase: true,
          feeQuote: true,
          feeBaseAcc: true,
          feeQuoteAcc: true,
          realisedPnLBase: true,
          realisedPnLQuote: true,
          executionFeeBase: true,
          executionFeeQuote: true,
          liquidationPenalty: true,
          liquidationPenaltyQuote: true,
          liquidationPenaltyBase: true,
          owner: { id: true },
          blockNumber: true,
          blockTimestamp: true,
          transactionHash: true,
          prevTransactionHash: true,
          dateTime: true,
          previousOpenCost: true,
          previousOpenQuantity: true,
          position: {
            number: true,
            openCost: true,
            id: true,
            moneyMarket: true,
            owner: { id: true },
            instrument: {
              symbol: true,
              id: true,
              base: {
                symbol: true,
                decimals: true,
                id: true,
                name: true,
              },
              quote: {
                symbol: true,
                decimals: true,
                id: true,
                name: true,
              },
            },
          },
        },
      ],
    })

  const response = await queryAll(chains, query)

  // TODO should we blow here instead?
  if (!response) {
    console.error("No results from any graph [positions]")
    return []
  }

  return response.result.historyItems.map((item) => {
    const instrument = transformInstrument(item.position.instrument)
    const { side } = instrument
    const isShort = side === Side.Short

    const prevState = transformFillItem(
      {
        ...item,
        fillSize: item.previousOpenQuantity,
        fillCost: item.previousOpenCost,
        equityBase: (Number(item.equityBaseAcc) - Number(item.equityBase)).toFixed(item.position.instrument.base.decimals),
        equityQuote: (Number(item.equityQuoteAcc) - Number(item.equityQuote)).toFixed(item.position.instrument.quote.decimals),
        feeBase: (Number(item.feeBaseAcc) - Number(item.feeBase)).toFixed(item.position.instrument.base.decimals),
        feeQuote: (Number(item.feeQuoteAcc) - Number(item.feeQuote)).toFixed(item.position.instrument.quote.decimals),
      },
      item.position.instrument,
      instrument,
    )
    const fillItem = transformFillItem(item, item.position.instrument, instrument)
    const [currentLot] = transformFillsToLots([prevState, fillItem], instrument).reverse()

    const [value, ccy] =
      item.cashflowCcy === Currency.Base
        ? [item.cashflowBase, transformAsset(item.position.instrument.base)]
        : [item.cashflowQuote, transformAsset(item.position.instrument.quote)]
    const cashflow = {
      value: decimalToBigint(value, ccy.decimals),
      ccy,
    }

    const fee = decimalToBigint(isShort ? item.feeBase : item.feeQuote, instrument.quote.decimals)
    const previousFees = decimalToBigint(isShort ? item.feeBaseAcc : item.feeQuoteAcc, instrument.quote.decimals) - fee
    const collateral = decimalToBigint(isShort ? item.cashflowBaseAcc : item.cashflowQuoteAcc, instrument.quote.decimals)
    const previousCollateral = collateral - decimalToBigint(isShort ? item.cashflowBase : item.cashflowQuote, instrument.quote.decimals)

    const executionPriceBN = decimalToBigint(item.fillPrice, isShort ? instrument.base.decimals : instrument.quote.decimals)
    const executionPrice = isShort ? mulDiv(instrument.quote.unit, instrument.base.unit, executionPriceBN) : executionPriceBN

    const baseUnit = BigInt(Math.pow(10, instrument.base.decimals))

    const executionFee = decimalToBigint((isShort ? item.executionFeeBase : item.executionFeeQuote) || "0", instrument.quote.decimals)

    // If there's any execution fee, it's taken from the cashflow after the order executed
    // This also means there's negative cashflow
    cashflow.value += executionFee

    const liquidationPenalty = decimalToBigint(item.liquidationPenalty || "0", 4)

    const liquidationPenaltyAmount =
      decimalToBigint((isShort ? item.liquidationPenaltyBase : item.liquidationPenaltyQuote) || "0", instrument.quote.decimals) * -1n

    return {
      type: item.type,
      id: item.id,
      positionId: formatId(item.position.id, chainId, item.position.owner.id),
      positionNumber: Number(item.position.number),
      transactionHash: item.transactionHash,
      // open cost
      previousOpenCost: prevState.fillCost,
      openCost: currentLot.openCost,
      // quantity
      previousOpenQuantity: prevState.fillSize,
      openQuantity: currentLot.quantity,
      openQuantityDelta: currentLot.quantity - prevState.fillSize,
      // entry price
      previousEntryPrice: mulDiv(prevState.fillCost, baseUnit, prevState.fillSize),
      entryPrice: currentLot.entryPrice,
      // fees
      previousFees,
      fee,

      cashflow,
      executionPrice,
      side,
      realisedPnL: currentLot.realisedPnL * (isShort ? -1n : 1n),

      collateral,
      previousCollateral,

      blockNumber: Number(item.blockNumber),
      blockTimestamp: Number(item.blockTimestamp), // unix timestamp

      chainId,
      owner: item.position.owner.id as Hex,
      instrument,

      // Limit orders
      executionFee,

      // Liquidations
      liquidationPenalty,
      liquidationPenaltyAmount,
    }
  })
}

export const queryNewPosition = async (chain: string, chainId: SupportedChainIds, positionId: Hex) => {
  const response = await Chain(chain)("query", { scalars })({
    position: [
      {
        id: positionId,
        subgraphError: _SubgraphErrorPolicy_.allow,
      },
      positionQuery,
    ],
  })

  const position = response.position
  if (position) {
    const mappedResponse = transformPosition(position)
    const id = formatId(position.id, chainId, position.owner.id)

    return {
      id,
      status: "inSync" as PositionStatus,
      ...mappedResponse,
    }
  } else {
    throw new Error("Position doesnt exist yet!")
  }
}
