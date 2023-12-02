import { publicClientConfigsByName } from "@/api/chain"
import { chartTickerToDecimals } from "@/api/graphql/instruments"
// import type {
//   Bar,
//   IDatafeedChartApi,
//   IExternalDatafeed,
//   LibrarySymbolInfo,
//   ResolutionString,
//   SubscribeBarsCallback,
// } from "@/charting_library/charting_library"
import { queryMarkPrices } from "@/vivex-xyz/sdk"
import { createPublicClient } from "viem"
import { PRICE_BACKEND } from "../../env"
const DATA_FEED_URI = `${PRICE_BACKEND}/prices/get`

const oneMininMs = 60 * 1 * 1000
const fivenMinsinMs = 60 * 5 * 1000
const fifteenMinsinMs = 60 * 15 * 1000
const hourInMs = 60 * 60 * 1000
const fourHourInMs = hourInMs * 4
const dayInMs = hourInMs * 24

const resolutions = {
  "1": oneMininMs,
  "5": fivenMinsinMs,
  "15": fifteenMinsinMs,
  // do NOT change '60' to '1H'. It's a TradingView thing  ¯\_(ツ)_/¯
  "60": hourInMs,
  "240": fourHourInMs,
  "1D": dayInMs,
}
// @ts-ignore
const supported_resolutions = Object.keys(resolutions) as TradingView.ResolutionString[]

type TimestreamPeriod = "1day" | "4hour" | "1hour" | "15m" | "5m" | "1m"

const getRawData = async (
  instrument: string,
  period: TimestreamPeriod,
  from: number,
  nRows: number,
  nTries = 1,
): Promise<{
  latestBlock: string
  prices: Array<[string, string, string, string, string] | [string, null, null, null, null]>
}> => {
  const queryString = new URLSearchParams({
    instrument: instrument.replace("/", ""),
    period,
    from: from.toString(10),
    nRows: nRows.toString(10),
    v2: "true",
  }).toString()
  const request = `${DATA_FEED_URI}?${queryString}`
  try {
    const response = await fetch(request)
    if (!response.ok) throw response
    return response.json()
  } catch (e: any) {
    console.log("Request failed", { request, nTries })
    if (nTries === 4) throw e
    try {
      // More often than not the failing cause will be in the body as a json, so
      // let's try to get it
      e.json()
        .then((m: any) => {
          console.log("failing message for", { request, nTries })
          console.log(m)
        })
        .catch(() => {
          console.log("unable to parse json from errored request", {
            request,
            nTries,
            e,
          })
        })
    } catch (_) {}
    await new Promise((res) => setTimeout(res, 250))
    console.log("retrying getRawData", { instrument, period, from, nRows })
    return getRawData(instrument, period, from, nRows, nTries + 1)
  }
}

const asPeriod = (resolution: string): TimestreamPeriod => {
  switch (resolution) {
    case "1D":
      return "1day"
    case "60":
      return "1hour"
    case "240":
      return "4hour"
    case "15":
      return "15m"
    case "5":
      return "5m"
    case "1":
      return "1m"
    default:
      throw new Error(`Unknown resolution ${resolution}`)
  }
}

// A cache for preventing unnecessary requests
const fromLimits = new Map<string, number>()

const getData = async (
  instrument: string,
  resolution: string,
  from: number,
  to: number,
  nRows: number,
): Promise<{
  latestBlock: number
  // @ts-ignore
  bars: Array<TradingView.Bar | { time: number }>
}> => {
  const period = asPeriod(resolution)

  const key = `${instrument}-${period}`
  if (to < fromLimits.get(key)!) return { latestBlock: 0, bars: [] }

  const rawData = await getRawData(instrument, period, from, nRows)

  const result = rawData.prices.map((data) => {
    const time = Number(data[0])
    if (data[1] === null) return { time }
    const [, firstVal, lastVal, minVal, maxVal] = data.map(Number)
    return {
      time,
      high: maxVal / 1e8,
      low: minVal / 1e8,
      open: firstVal / 1e8,
      close: lastVal / 1e8,
    }
  })

  if (result[0]?.time - from > resolutions[resolution as "60"]) {
    // if the time of the first data-point is greater than the `from` parameter,
    // that means that we have found the first data-point for that symbol (and period)
    // which means that if in the future TradingView asks for data that's prior to
    // that time, then we don't have to make a fetch request, because we know that
    // there is no data before that point.
    fromLimits.set(key, result[0].time)
  }

  return { latestBlock: parseInt(rawData.latestBlock), bars: result }
}

function alignStartTime(startTime: number, periodMs: number): number {
  // Align startTime to the nearest previous interval consistent with `bin`
  return startTime - (startTime % periodMs)
}

function fillBars(bars: any[], periodMs: number, startTime: number, minCandles: number): any[] {
  const filledBars = []
  const endTime = bars[bars.length - 1].time
  startTime = alignStartTime(startTime, periodMs)

  for (let time = startTime; time <= endTime; time += periodMs) {
    const existingBar = bars.find((c) => c.time === time)
    if (existingBar) {
      filledBars.push(existingBar)
    } else {
      const lastBar = (filledBars[filledBars.length - 1] || null) as any
      const closePrice = lastBar ? lastBar.close : (bars[0] || {}).close || 0
      filledBars.push({
        time,
        high: closePrice,
        low: closePrice,
        open: closePrice,
        close: closePrice,
      })
    }
  }

  // Prepend placeholder bars if the filledBars array is shorter than minCandles
  while (filledBars.length < minCandles) {
    startTime -= periodMs // Go back one period
    filledBars.unshift({
      time: startTime,
    })
  }

  return filledBars
}
// @ts-ignore
interface BarWithBlock extends TradingView.Bar {
  latestBlock: number
}
const latestBars = new Map<string, BarWithBlock>()
// @ts-ignore
const getBars: TradingView.IDatafeedChartApi["getBars"] = async (symbolInfo, resolution, periodParams, onHistoryCallback) => {
  console.log("[getBars]: Method call", {
    symbolInfo,
    resolution,
    periodParams,
  })

  const data = await getData(symbolInfo.name, resolution, periodParams.from * 1000, periodParams.to * 1000, periodParams.countBack)
// @ts-ignore
  const bars = data.bars as TradingView.Bar[]

  if (bars.length === 0) return onHistoryCallback(bars, { noData: true })

  latestBars.set(`${symbolInfo.name}_#_${resolution}`, { ...bars[bars.length - 1], latestBlock: data.latestBlock })

  // It's important to always return *at least* the number of bars
  // that TradingView has requested through the `countBack` parameter
  if (bars.length >= periodParams.countBack) return onHistoryCallback(bars)

  // if we don't have enough data-points, then we must fill the gaps
  const timeGap = resolutions[resolution as "60"]

  const filledBars = fillBars(bars, timeGap, periodParams.from * 1000, periodParams.countBack)

  return onHistoryCallback(filledBars)
}
// @ts-ignore
const onReady: TradingView.IExternalDatafeed["onReady"] = async (callback) => {
  // TradingView complains if the callback is called synchronously
  await Promise.resolve()

  callback({
    supported_resolutions,
    exchanges: [
      {
        value: "Contango",
        name: "Contango",
        desc: "Contango: Bringing Experables to DeFi",
      },
    ],
    symbols_types: [{ name: "crypto", value: "crypto" }],
  })
}
// @ts-ignore
const resolveSymbol: TradingView.IDatafeedChartApi["resolveSymbol"] = async (symbolName, onSymbolResolvedCallback) => {
  // TradingView complains if the callback is called synchronously
  await Promise.resolve()

  const displayDecimals = chartTickerToDecimals.get(symbolName) || 2
  const pricescale = Math.pow(10, displayDecimals)

  onSymbolResolvedCallback({
    ticker: symbolName,
    name: symbolName,
    full_name: symbolName,
    description: symbolName,
    type: "crypto",
    session: "24x7",
    timezone: "Etc/UTC",
    exchange: "Contango",
    listed_exchange: "Contango",
    format: "price",
    minmov: 1,
    has_intraday: true,
    visible_plots_set: "ohlc",
    has_weekly_and_monthly: false,
    supported_resolutions,
    volume_precision: 2,
    data_status: "streaming",
    pricescale,
  })
}
// @ts-ignore
const searchSymbols: TradingView.IDatafeedChartApi["searchSymbols"] = (userInput, exchange, symbolType, onResult) => {
  console.log("[searchSymbols]", { userInput, exchange, symbolType })
  // It's required to implement this function. However, I think that
  // taken into account the way that we have customized the chart, we
  // actually don't need to handle this
  // TODO: review this
  onResult([])
}

export const toDecimals = 8n
// @ts-ignore
const updateBar = (bar: TradingView.Bar, price: number, latestBlock: number) => {
  // console.log("[updateBar]", { price, latestBlock })
  return {
    ...bar,
    open: bar.open === 0 ? price : bar.open,
    high: Math.max(bar.high, price),
    low: bar.low === 0 ? price : Math.min(bar.low, price),
    close: price,
    latestBlock,
  }
}
// @ts-ignore
const nextBar = (bar: TradingView.Bar, time: number, latestBlock: number) => {
  return {
    time,
    open: bar.close,
    high: bar.close,
    low: bar.close,
    close: bar.close,
    latestBlock,
  }
}

const nextRunAt = (): number => {
  const now = new Date()
  const currentSeconds = now.getSeconds()
  const currentMilliseconds = now.getMilliseconds()

  // Calculate the next multiple of 5 seconds.
  // If the seconds are a multiple of 5, we schedule for the next 5 second interval.
  const nextTargetSecond = currentSeconds % 5 === 0 ? currentSeconds + 5 : Math.ceil(currentSeconds / 5) * 5
  let delay: number

  if (nextTargetSecond >= 60) {
    // If the next target second is 60 or more, schedule for the 0th second of the next minute
    delay = (60 - currentSeconds) * 1000 - currentMilliseconds
  } else {
    // Otherwise, schedule for the next target second within the current minute
    delay = (nextTargetSecond - currentSeconds) * 1000 - currentMilliseconds
  }

  return delay + 1000 // add 1 second to be sure we are in the next minute
}

// queryMarkPrices() will min this against the latest block
const toBlock = BigInt(Number.MAX_SAFE_INTEGER)

const providerFn = (chain: string) => {
  const conf = publicClientConfigsByName[chain]

  if (!conf) throw new Error(`No public client config found for chain ${chain}`)

  return createPublicClient({
    ...conf,
    batch: { multicall: true },
    cacheTime: 10_000,
  })
}

// @ts-ignore
const subscribeBars: TradingView.IDatafeedChartApi["subscribeBars"] = async (
  // @ts-ignore
  symbolInfo: TradingView.LibrarySymbolInfo,
  // @ts-ignore
  resolution: TradingView.ResolutionString,
  // @ts-ignore
  onTick: TradingView.SubscribeBarsCallback,
  listenerGuid: string,
) => {
  const [base, quote] = symbolInfo.name.split("/")

  console.log("[subscribeBars]", { listenerGuid, base, quote })

  const priceFeed = async () => {
    // When the chart unsubscribes, we'll delete the latestBars entry, so we stop this recursive function
    if (!latestBars.has(listenerGuid)) {
      return
    }
    let bar = latestBars.get(listenerGuid)!

    const resolutionDuration = resolutions[resolution as "60"]
    // @ts-ignore
    let nextBarStart = bar.time + resolutionDuration

    const fromBlock = BigInt(bar.latestBlock) + 1n

    try {
      const prices = await queryMarkPrices(providerFn, base, quote, {
        fromBlock,
        toBlock,
        toDecimals,
      })

      // console.log(`[priceFeed] got ${prices.length} prices from block ${fromBlock} till latest`)

      prices.forEach((p) => {
        const priceMs = p.timestamp * 1000

        // Discard updates too old for the current bar (belt & braces)
        // @ts-ignore
        if (priceMs < bar.time) return

        const price = Number(p.markPrice) / 1e8

        if (priceMs < nextBarStart) {
          bar = updateBar(bar, price, p.blockNumber)
        } else {
          onTick(bar)
          bar = nextBar(bar, nextBarStart, p.blockNumber)
          // @ts-ignore
          nextBarStart = bar.time + resolutionDuration
          bar = updateBar(bar, price, p.blockNumber)
        }
      })

      onTick(bar)

      // In case we have no updates, but we have reached the next bar, we need to create an empty one
      if (Date.now() >= nextBarStart + 60_000) {
        console.log("[priceFeed] creating empty bar")
        bar = nextBar(bar, nextBarStart, bar.latestBlock)
        onTick(bar)
      }

      latestBars.set(listenerGuid, bar)
    } catch (e) {
      console.error("Failed to query mark prices", (e as any).additionalInfo, e)
    }

    setTimeout(() => priceFeed(), nextRunAt())
  }

  priceFeed()
}

export const datafeed = {
  onReady,
  searchSymbols,
  resolveSymbol,
  getBars,
  subscribeBars,
  unsubscribeBars: (subscriberUID: any) => {
    console.log("[unsubscribeBars]", subscriberUID)
    latestBars.delete(subscriberUID)
  },
}
