import { HistoryItem_orderBy, OrderDirection, Order_orderBy, Selector } from "../zeus"

export const metaQuery = Selector("_Meta_")({
  block: {
    number: true,
  },
})

export const historyItemQuery = Selector("HistoryItem")({
  blockTimestamp: true,
  openQuantity: true,
  previousOpenQuantity: true,
  openCost: true,
  previousOpenCost: true,
  realisedPnLBase: true,
  realisedPnLQuote: true,
  equityQuote: true,
  equityBase: true,
  fillCost: true,
  fillSize: true,
  feeBase: true,
  feeQuote: true,
  id: true,
})

export const positionQuery = Selector("Position")({
  id: true,
  feesBase: true,
  feesQuote: true,
  instrument: {
    symbol: true,
    id: true,
    base: {
      decimals: true,
      symbol: true,
      id: true,
      name: true,
    },
    quote: {
      decimals: true,
      symbol: true,
      id: true,
      name: true,
    },
  },
  history: [
    {
      orderBy: HistoryItem_orderBy.blockTimestamp,
      orderDirection: OrderDirection.desc,
    },
    historyItemQuery,
  ],
  orders: [
    {
      orderBy: Order_orderBy.blockNumber,
      orderDirection: OrderDirection.desc,
    },
    {
      limitPrice: true,
      type: true,
      id: true,
    },
  ],
  quantity: true,
  openCost: true,
  cashflowBase: true,
  cashflowQuote: true,
  equityBase: true,
  equityQuote: true,
  number: true,
  realisedPnLBase: true,
  realisedPnLQuote: true,
  owner: { id: true },
  creationBlockTimestamp: true,
})
