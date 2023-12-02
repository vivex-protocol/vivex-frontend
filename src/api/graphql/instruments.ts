import { SupportedChainIds } from "@/api/chain"
import { MoneyMarket } from "@/vivex-xyz/sdk"
import { Hex, stringToHex } from "viem"

export type CtxInstrumentId = `${Hex}-${SupportedChainIds}`

const ARB = 42_161
const OP = 10
const ETH = 1
const POLYGON = 137
const GNO = 100
const BASE = 8453

export type AssetSymbol =
  | "USDC"
  | "USDC.e"
  | "DAI"
  | "ETH"
  | "WBTC"
  | "wstETH"
  | "USDT"
  | "ARB"
  | "rETH"
  | "LUSD"
  // | "MATIC"
  // | "MaticX"
  // | "stMATIC"
  // | "SNX"
  // | "UNI"
  | "LINK"
  | "AAVE"
  // | "MKR"
  // | "CRV"
  // | "cbETH"
  // | "USDbC"
  // | "OP"
  // | "EXA"
  // | "esEXA"
export interface Asset {
  decimals: number
  symbol: AssetSymbol
  displayDecimals: number
}

export const assets: Record<AssetSymbol, Asset> = {
  USDC: {
    decimals: 6,
    symbol: "USDC",
    displayDecimals: 2,
  },
  // USDbC: {
  //   decimals: 6,
  //   symbol: "USDbC",
  //   displayDecimals: 2,
  // },
  "USDC.e": {
    decimals: 6,
    symbol: "USDC.e",
    displayDecimals: 2,
  },
  DAI: {
    decimals: 18,
    symbol: "DAI",
    displayDecimals: 2,
  },
  ETH: {
    decimals: 18,
    symbol: "ETH",
    displayDecimals: 3,
  },
  WBTC: {
    decimals: 8,
    symbol: "WBTC",
    displayDecimals: 3,
  },
  wstETH: {
    decimals: 18,
    symbol: "wstETH",
    displayDecimals: 3,
  },
  USDT: {
    decimals: 6,
    symbol: "USDT",
    displayDecimals: 2,
  },
  ARB: {
    decimals: 18,
    symbol: "ARB",
    displayDecimals: 2,
  },
  rETH: {
    decimals: 18,
    symbol: "rETH",
    displayDecimals: 3,
  },
  LUSD: {
    decimals: 18,
    symbol: "LUSD",
    displayDecimals: 2,
  },
  // MATIC: {
  //   decimals: 18,
  //   symbol: "MATIC",
  //   displayDecimals: 2,
  // },
  // MaticX: {
  //   decimals: 18,
  //   symbol: "MaticX",
  //   displayDecimals: 2,
  // },
  // stMATIC: {
  //   decimals: 18,
  //   symbol: "stMATIC",
  //   displayDecimals: 2,
  // },
  // SNX: {
  //   decimals: 18,
  //   symbol: "SNX",
  //   displayDecimals: 2,
  // },
  // UNI: {
  //   decimals: 18,
  //   symbol: "UNI",
  //   displayDecimals: 2,
  // },
  LINK: {
    decimals: 18,
    symbol: "LINK",
    displayDecimals: 2,
  },
  AAVE: {
    decimals: 18,
    symbol: "AAVE",
    displayDecimals: 2,
  },
  // MKR: {
  //   decimals: 18,
  //   symbol: "MKR",
  //   displayDecimals: 2,
  // },
  // CRV: {
  //   decimals: 18,
  //   symbol: "CRV",
  //   displayDecimals: 2,
  // },
  // cbETH: {
  //   decimals: 18,
  //   symbol: "cbETH",
  //   displayDecimals: 3,
  // },
  // OP: {
  //   decimals: 18,
  //   symbol: "OP",
  //   displayDecimals: 2,
  // },
  // EXA: {
  //   decimals: 18,
  //   symbol: "EXA",
  //   displayDecimals: 2,
  // },
  // esEXA: {
  //   decimals: 18,
  //   symbol: "esEXA",
  //   displayDecimals: 2,
  // },
}

export type Pair = {
  symbol: string
  base: Asset
  quote: Asset
  Long: CtxInstrumentId[]
  Short: CtxInstrumentId[]
  chartTicker: string
}

const PERP = 2 ** 32 - 1

enum Flags {
  Aave_E_MODE = 0,
  Aave_ISOLATION_MODE = 1,
}

const encode = ({
  base,
  quote,
  moneyMarket,
  expiry = PERP,
  flags = [],
  number = 0,
  chainId,
}: {
  base: Asset
  quote: Asset
  // @ts-ignore
  moneyMarket: MoneyMarket
  expiry?: number
  flags?: Flags[]
  number?: number
  chainId: SupportedChainIds
}): CtxInstrumentId => {
  const setBits = (bitPositions: Flags[]): number => {
    let num = 0
    for (const pos of bitPositions) {
      num |= 1 << pos
    }
    return num
  }

  const symbol = (asset: Asset) => {
    if (asset.symbol === assets.USDC.symbol && [ARB, OP, POLYGON, GNO].includes(chainId)) {
      return "USDC.n"
    }
    if (asset.symbol === assets["USDC.e"].symbol && [ARB, OP, POLYGON, GNO].includes(chainId)) {
      return "USDC"
    }
    if (asset.symbol === assets.ETH.symbol) {
      return "WETH"
    }
    // if (asset.symbol === assets.MATIC.symbol) {
    //   return "WMATIC"
    // }
    if (asset.symbol === assets.DAI.symbol && chainId === GNO) {
      return "WXDAI"
    }
    return asset.symbol
  }

  // Includes 0x prefix
  const hexSymbol = stringToHex(`${symbol(base)}${symbol(quote)}`, { size: 16 })
  // Convert numbers to padded hex (without "0x" prefix)
  const hexMoneyMarket = moneyMarket.toString(16).padStart(2, "0")
  const hexExpiry = expiry.toString(16).padStart(8, "0")
  const hexFlags = setBits(flags).toString(16).padStart(2, "0")
  const hexNumber = number.toString(16).padStart(12, "0")

  // Concatenate all the hex strings
  return `${hexSymbol}${hexMoneyMarket}${hexExpiry}${hexFlags}00000000${hexNumber}-${chainId}`
}

type Legs = {
  // @ts-ignore
  moneyMarket: MoneyMarket
  chainId: SupportedChainIds
  flags?: Flags[]
}
// @ts-ignore
const legs = (moneyMarket: MoneyMarket, chainIds: SupportedChainIds[], flags?: Flags[]): Legs[] => {
  return chainIds.map((chainId) => ({ moneyMarket, chainId, flags }))
}

export const chartSymbol = (asset: Asset) => {
  switch (asset.symbol) {
    case assets.USDC.symbol:
    case assets["USDC.e"].symbol:
    // case assets.USDbC.symbol:
      return "USDC"
    case assets.ETH.symbol:
      return "WETH"
    // case assets.MATIC.symbol:
    //   return "WMATIC"
    default:
      return asset.symbol
  }
}

const pair = ({
  base,
  quote,
  longs = [],
  shorts = [],
  flags = [],
}: {
  base: Asset
  quote: Asset
  longs?: Legs[]
  shorts?: Legs[]
  flags?: Flags[]
}): Pair => {
  const allFlags = (legFlags?: Flags[]) => Array.from(new Set([...flags, ...(legFlags ?? [])]))

  return {
    symbol: `${base.symbol}/${quote.symbol}`,
    base,
    quote,
    Long: longs.map((x) => encode({ base, quote, ...x, flags: allFlags(x.flags) })),
    Short: shorts.map((x) => encode({ base: quote, quote: base, ...x, flags: allFlags(x.flags) })),
    chartTicker: `${chartSymbol(base)}/${chartSymbol(quote)}`.toUpperCase(),
  }
}

const sortByChainIdAndMM = (a: CtxInstrumentId, b: CtxInstrumentId) => {
  const [aa, bb] = [a, b].map((id) => {
    const [posId, chainId] = id.split("-")
    return { chainId: Number(chainId), mm: Number(`0x${posId.substring(34, 36)}`) }
  })
  return aa.chainId - bb.chainId || aa.mm - bb.mm
}

const pairs = ({
  bases,
  quotes,
  longs,
  shorts,
  flags,
}: {
  bases: Asset[]
  quotes: Asset[]
  longs?: Legs[]
  shorts?: Legs[]
  flags?: Flags[]
}) => {
  const res = bases.flatMap((base) => quotes.map((quote) => pair({ base, quote, longs, shorts, flags })))
  res.forEach((pair) => {
    pair.Long = pair.Long.sort(sortByChainIdAndMM)
    pair.Short = pair.Short.sort(sortByChainIdAndMM)
  })
  return res
}

const [WETHUSDCe, wstETHUSDCe] = pairs({
  bases: [assets.ETH, assets.wstETH],
  quotes: [assets["USDC.e"]],
  longs: [
    // ...legs(MoneyMarket.Aave, [ARB, OP, POLYGON, GNO]),
    ...legs(MoneyMarket.Aave, [ARB]),
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
    // { moneyMarket: MoneyMarket.Exactly, chainId: OP },
  ],
  shorts: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, OP, POLYGON, GNO]),
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
    // { moneyMarket: MoneyMarket.Exactly, chainId: OP },
  ],
})

const [WBTCUSDCe] = pairs({
  bases: [assets.WBTC],
  quotes: [assets["USDC.e"]],
  longs: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, OP, POLYGON]),
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  ],
  shorts: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, OP, POLYGON]),
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  ],
})

const rETHUSDCe: Pair = pair({
  base: assets.rETH,
  quote: assets["USDC.e"],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, OP])],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, OP])],
})

const [rETHDAI] = pairs({
  bases: [assets.rETH],
  quotes: [assets.DAI],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, ETH]), { moneyMarket: MoneyMarket.Spark, chainId: ETH }],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, ETH]), { moneyMarket: MoneyMarket.Spark, chainId: ETH }],
})

const [WETHUSDC, wstETHUSDC, rETHUSDC] = pairs({
  bases: [assets.ETH, assets.wstETH, assets.rETH],
  quotes: [assets.USDC],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, ETH]), { moneyMarket: MoneyMarket.Spark, chainId: ETH }],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, ETH]), { moneyMarket: MoneyMarket.Spark, chainId: ETH }],
})

const [WBTCUSDC] = pairs({
  bases: [assets.WBTC],
  quotes: [assets.USDC],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, ETH])],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, ETH])],
})

const [WBTCDAI] = pairs({
  bases: [assets.WBTC],
  quotes: [assets.DAI],
  longs: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, ETH]),
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    // { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  ],
  shorts: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, ETH]),
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    // { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  ],
})

const [WETHDAI, wstETHDAI] = pairs({
  bases: [assets.ETH, assets.wstETH],
  quotes: [assets.DAI],
  longs: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, ETH, GNO]),
    // ...legs(MoneyMarket.Spark, [ETH, GNO]),
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    // { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  ],
  shorts: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, ETH, GNO]),
    // ...legs(MoneyMarket.Spark, [ETH, GNO]),
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    // { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  ],
})

const [WETHUSDT, wstETHUSDT, WBTCUSDT] = pairs({
  bases: [assets.ETH, assets.wstETH, assets.WBTC, assets.rETH],
  quotes: [assets.USDT],
  longs: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, OP, ETH, POLYGON]),
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    // { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  ],
  // shorts: [
    // { moneyMarket: MoneyMarket.Aave, chainId: ETH },
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    // { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  // ],
})

const [rETHUSDT] = pairs({
  bases: [assets.rETH],
  quotes: [assets.USDT],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, OP, ETH])],
  // shorts: [{ moneyMarket: MoneyMarket.Aave, chainId: ETH }],
  // shorts: [{ moneyMarket: MoneyMarket.Aave, chainId: ETH }],
})

const [WETHLUSD, wstETHLUSD, WBTCLUSD, rETHLUSD] = pairs({
  bases: [assets.ETH, assets.wstETH, assets.WBTC, assets.rETH],
  quotes: [assets.LUSD],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, OP, ETH])],
  // shorts: [...legs(MoneyMarket.Aave, [ETH])],
})

const [WETHWBTC, wstETHWBTC] = pairs({
  bases: [assets.ETH, assets.wstETH],
  quotes: [{ ...assets.WBTC, displayDecimals: 6 }],
  longs: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, OP, ETH, POLYGON]),
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    // { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  ],
  shorts: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, OP, ETH, POLYGON]),
    // { moneyMarket: MoneyMarket.Agave, chainId: GNO },
    // { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  ],
})

const [rETHWBTC] = pairs({
  bases: [assets.rETH],
  quotes: [{ ...assets.WBTC, displayDecimals: 6 }],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, OP, ETH])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, OP, ETH])],
})

const wstETHWETH = pair({
  base: assets.wstETH,
  quote: { ...assets.ETH, displayDecimals: 6 },
  flags: [Flags.Aave_E_MODE],
  longs: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, OP, ETH, POLYGON, GNO]),
    // ...legs(MoneyMarket.Spark, [ETH, GNO]),
    // { moneyMarket: MoneyMarket.Exactly, chainId: OP },
  ],
  shorts: [
    ...legs(MoneyMarket.Aave, [ARB]),
    // ...legs(MoneyMarket.Aave, [ARB, OP, ETH, POLYGON, GNO]),
    // ...legs(MoneyMarket.Spark, [ETH, GNO]),
    // { moneyMarket: MoneyMarket.Exactly, chainId: OP },
  ],
})

const rETHWETH = pair({
  base: assets.rETH,
  quote: { ...assets.ETH, displayDecimals: 6 },
  flags: [Flags.Aave_E_MODE],
  longs: [...legs(MoneyMarket.Aave, [/* ARB, */ OP, ETH])],
  shorts: [...legs(MoneyMarket.Aave, [/* ARB, */ OP, ETH])],
})

const [ARBUSDCe, ARBDAI] = pairs({
  bases: [assets.ARB],
  quotes: [assets["USDC.e"], assets.DAI],
  longs: [
    { moneyMarket: MoneyMarket.Aave, chainId: ARB, flags: [Flags.Aave_ISOLATION_MODE] },
    // { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  ],
  shorts: [
    { moneyMarket: MoneyMarket.Aave, chainId: ARB },
    // { moneyMarket: MoneyMarket.Radiant, chainId: ARB },
  ],
})

const [ARBUSDC] = pairs({
  bases: [assets.ARB],
  quotes: [assets.USDC],
  longs: [{ moneyMarket: MoneyMarket.Aave, chainId: ARB, flags: [Flags.Aave_ISOLATION_MODE] }],
  shorts: [{ moneyMarket: MoneyMarket.Aave, chainId: ARB }],
})

const [ARBLUSD] = pairs({
  bases: [assets.ARB],
  quotes: [assets.LUSD],
  longs: [{ moneyMarket: MoneyMarket.Aave, chainId: ARB, flags: [Flags.Aave_ISOLATION_MODE] }],
})

const [DAIUSDCe] = pairs({
  bases: [assets.DAI],
  quotes: [{ ...assets["USDC.e"], displayDecimals: 6 }],
  flags: [Flags.Aave_E_MODE],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, OP, POLYGON])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, OP, POLYGON])],
})

const [DAIUSDC] = pairs({
  bases: [assets.DAI],
  quotes: [{ ...assets.USDC, displayDecimals: 6 }],
  flags: [Flags.Aave_E_MODE],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, ETH])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, ETH])],
})

const [DAIUSDT] = pairs({
  bases: [assets.DAI],
  quotes: [{ ...assets.USDT, displayDecimals: 6 }],
  flags: [Flags.Aave_E_MODE],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  shorts: [...legs(MoneyMarket.Aave, [ARB], [Flags.Aave_ISOLATION_MODE])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, OP, ETH, POLYGON])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, OP, ETH, POLYGON], [Flags.Aave_ISOLATION_MODE])],
})

const [LUSDUSDCe] = pairs({
  bases: [assets.LUSD],
  quotes: [{ ...assets["USDC.e"], displayDecimals: 6 }],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, OP])],
})

const [LUSDUSDC] = pairs({
  bases: [assets.LUSD],
  quotes: [{ ...assets.USDC, displayDecimals: 6 }],
  // longs: [...legs(MoneyMarket.Aave, [ETH])],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, ETH])],
})

const [LUSDUSDT] = pairs({
  bases: [assets.LUSD],
  quotes: [{ ...assets.USDT, displayDecimals: 6 }],
  // longs: [...legs(MoneyMarket.Aave, [ETH])],
  // shorts: [...legs(MoneyMarket.Aave, [ETH])],
})

// const [WMATICUSDCe, WMATICDAI, MaticXUSDCe, MaticXDAI] = pairs({
//   bases: [assets.MATIC, assets.MaticX],
//   quotes: [assets["USDC.e"], assets.DAI],
//   longs: [...legs(MoneyMarket.Aave, [POLYGON])],
//   shorts: [...legs(MoneyMarket.Aave, [POLYGON])],
// })

// const [stMATICUSDCe, stMATICDAI] = pairs({
//   bases: [assets.stMATIC],
//   quotes: [assets["USDC.e"], assets.DAI],
//   longs: [...legs(MoneyMarket.Aave, [POLYGON])],
//   shorts: [],
// })

// const [MaticXWMATIC] = pairs({
//   bases: [assets.MaticX],
//   quotes: [{ ...assets.MATIC, displayDecimals: 6 }],
//   flags: [Flags.Aave_E_MODE],
//   longs: [...legs(MoneyMarket.Aave, [POLYGON])],
//   shorts: [...legs(MoneyMarket.Aave, [POLYGON])],
// })

// const [stMATICWMATIC] = pairs({
//   bases: [assets.stMATIC],
//   quotes: [{ ...assets.MATIC, displayDecimals: 6 }],
//   flags: [Flags.Aave_E_MODE],
//   longs: [...legs(MoneyMarket.Aave, [POLYGON])],
// })

const [LINKDAI, LINKUSDT, LINKWETH] = pairs({
  bases: [assets.LINK],
  quotes: [assets.DAI, assets.USDT, { ...assets.ETH, displayDecimals: 6 }],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, OP, ETH, POLYGON])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, OP, ETH, POLYGON])],
})
const [LINKUSDC] = pairs({
  bases: [assets.LINK],
  quotes: [assets.USDC],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, ETH])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, ETH])],
})
const [LINKUSDCe] = pairs({
  bases: [assets.LINK],
  quotes: [assets["USDC.e"]],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  shorts: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, OP, POLYGON])],
  // shorts: [...legs(MoneyMarket.Aave, [ARB, OP, POLYGON])],
})

// CRV can't be borrowed
// const [CRVDAI, CRVUSDT, CRVWETH] = pairs({
//   bases: [assets.CRV],
//   quotes: [assets.DAI, assets.USDT, { ...assets.ETH, displayDecimals: 6 }],
//   longs: [...legs(MoneyMarket.Aave, [ETH, POLYGON])],
// })
// const [CRVUSDC] = pairs({
//   bases: [assets.CRV],
//   quotes: [assets.USDC],
//   longs: [...legs(MoneyMarket.Aave, [ETH])],
// })
// const [CRVUSDCe] = pairs({
//   bases: [assets.CRV],
//   quotes: [assets["USDC.e"]],
//   longs: [...legs(MoneyMarket.Aave, [POLYGON])],
// })

// AAVE can't be borrowed
const [AAVEDAI, AAVEUSDT, AAVEWETH] = pairs({
  bases: [assets.AAVE],
  quotes: [assets.DAI, assets.USDT, assets.ETH],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, OP, ETH])],
})
const [AAVEUSDC] = pairs({
  bases: [assets.AAVE],
  quotes: [assets.USDC],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, ETH])],
})
const [AAVEUSDCe] = pairs({
  bases: [assets.AAVE],
  quotes: [assets["USDC.e"]],
  longs: [...legs(MoneyMarket.Aave, [ARB])],
  // longs: [...legs(MoneyMarket.Aave, [ARB, OP, POLYGON])],
})

// const [SNXUSDC, SNXDAI, SNXUSDT, UNIUSDC, UNIDAI, UNIUSDT, MKRUSDC, MKRDAI, MKRUSDT] = pairs({
//   bases: [assets.SNX, assets.UNI, assets.MKR],
//   quotes: [assets.USDC, assets.DAI, assets.USDT],
//   longs: [...legs(MoneyMarket.Aave, [ETH], [Flags.Aave_ISOLATION_MODE])],
//   shorts: [...legs(MoneyMarket.Aave, [ETH])],
// })

// const [cbETHWETH] = pairs({
//   bases: [assets.cbETH],
//   quotes: [{ ...assets.ETH, displayDecimals: 6 }],
//   flags: [Flags.Aave_E_MODE],
//   longs: [...legs(MoneyMarket.Aave, [ETH, BASE])],
//   shorts: [...legs(MoneyMarket.Aave, [ETH, BASE])],
// })

// const [cbETHUSDC, cbETHDAI, cbETHUSDT] = pairs({
//   bases: [assets.cbETH],
//   quotes: [assets.USDC, assets.DAI, assets.USDT],
//   longs: [...legs(MoneyMarket.Aave, [ETH])],
//   shorts: [...legs(MoneyMarket.Aave, [ETH])],
// })

// const [WETHUSDbC, cbETHUSDbC] = pairs({
//   bases: [assets.ETH, assets.cbETH],
//   quotes: [assets.USDbC],
//   longs: [...legs(MoneyMarket.Aave, [BASE])],
//   shorts: [...legs(MoneyMarket.Aave, [BASE])],
// })

export const availablePairs: Record<string, Pair> = {
  [WETHUSDCe.symbol]: WETHUSDCe,
  [WBTCUSDCe.symbol]: WBTCUSDCe,
  [wstETHUSDCe.symbol]: wstETHUSDCe,
  [rETHUSDCe.symbol]: rETHUSDCe,
  [ARBUSDCe.symbol]: ARBUSDCe,
  // [WMATICUSDCe.symbol]: WMATICUSDCe,
  // [MaticXUSDCe.symbol]: MaticXUSDCe,
  // [stMATICUSDCe.symbol]: stMATICUSDCe,
  [AAVEUSDCe.symbol]: AAVEUSDCe,
  // [CRVUSDCe.symbol]: CRVUSDCe,
  [LINKUSDCe.symbol]: LINKUSDCe,
  [DAIUSDCe.symbol]: DAIUSDCe,
  [LUSDUSDCe.symbol]: LUSDUSDCe,
  [WETHUSDC.symbol]: WETHUSDC,
  [WBTCUSDC.symbol]: WBTCUSDC,
  [wstETHUSDC.symbol]: wstETHUSDC,
  [rETHUSDC.symbol]: rETHUSDC,
  // [cbETHUSDC.symbol]: cbETHUSDC,
  [ARBUSDC.symbol]: ARBUSDC,
  // [SNXUSDC.symbol]: SNXUSDC,
  // [UNIUSDC.symbol]: UNIUSDC,
  // [MKRUSDC.symbol]: MKRUSDC,
  [AAVEUSDC.symbol]: AAVEUSDC,
  // [CRVUSDC.symbol]: CRVUSDC,
  [LINKUSDC.symbol]: LINKUSDC,
  [DAIUSDC.symbol]: DAIUSDC,
  [LUSDUSDC.symbol]: LUSDUSDC,
  // [WETHUSDbC.symbol]: WETHUSDbC,
  // [cbETHUSDbC.symbol]: cbETHUSDbC,
  [WETHDAI.symbol]: WETHDAI,
  [WBTCDAI.symbol]: WBTCDAI,
  [ARBDAI.symbol]: ARBDAI,
  [wstETHDAI.symbol]: wstETHDAI,
  [rETHDAI.symbol]: rETHDAI,
  // [cbETHDAI.symbol]: cbETHDAI,
  // [WMATICDAI.symbol]: WMATICDAI,
  // [MaticXDAI.symbol]: MaticXDAI,
  // [stMATICDAI.symbol]: stMATICDAI,
  // [SNXDAI.symbol]: SNXDAI,
  // [UNIDAI.symbol]: UNIDAI,
  // [MKRDAI.symbol]: MKRDAI,
  [AAVEDAI.symbol]: AAVEDAI,
  // [CRVDAI.symbol]: CRVDAI,
  [LINKDAI.symbol]: LINKDAI,
  [WETHUSDT.symbol]: WETHUSDT,
  [WBTCUSDT.symbol]: WBTCUSDT,
  [wstETHUSDT.symbol]: wstETHUSDT,
  [rETHUSDT.symbol]: rETHUSDT,
  // [cbETHUSDT.symbol]: cbETHUSDT,
  [DAIUSDT.symbol]: DAIUSDT,
  // [LUSDUSDT.symbol]: LUSDUSDT,
  [DAIUSDT.symbol]: DAIUSDT,
  // [LUSDUSDT.symbol]: LUSDUSDT,
  // [SNXUSDT.symbol]: SNXUSDT,
  // [UNIUSDT.symbol]: UNIUSDT,
  // [MKRUSDT.symbol]: MKRUSDT,
  [AAVEUSDT.symbol]: AAVEUSDT,
  // [CRVUSDT.symbol]: CRVUSDT,
  [LINKUSDT.symbol]: LINKUSDT,
  [wstETHWETH.symbol]: wstETHWETH,
  // [rETHWETH.symbol]: rETHWETH,
  // [cbETHWETH.symbol]: cbETHWETH,
  [LINKWETH.symbol]: LINKWETH,
  [AAVEWETH.symbol]: AAVEWETH,
  // [CRVWETH.symbol]: CRVWETH,
  [WETHWBTC.symbol]: WETHWBTC,
  [wstETHWBTC.symbol]: wstETHWBTC,
  [rETHWBTC.symbol]: rETHWBTC,
  [WETHLUSD.symbol]: WETHLUSD,
  [WBTCLUSD.symbol]: WBTCLUSD,
  [wstETHLUSD.symbol]: wstETHLUSD,
  [rETHLUSD.symbol]: rETHLUSD,
  [ARBLUSD.symbol]: ARBLUSD,
  // [MaticXWMATIC.symbol]: MaticXWMATIC,
  // [stMATICWMATIC.symbol]: stMATICWMATIC,
} as const

export const chartTickerToDecimals = new Map(Object.values(availablePairs).map((x) => [x.chartTicker, x.quote.displayDecimals]))

export const shortIdsSet = new Set(
  Object.values(availablePairs)
    .flatMap((p) => p.Short)
    .map((x) => x.substring(0, 34)),
)

export const activeMoneyMarkets = new Set(
  // @ts-ignore
  Object.values(availablePairs).flatMap((p) => [...p.Short, ...p.Long].map((x) => Number(`0x${x.substring(34, 36)}`) as MoneyMarket)),
)

export type ValueOf<T> = T[keyof T]
