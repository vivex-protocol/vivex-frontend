// useCachedData.js
import { useEffect, useState } from "react"

type CacheEntry = {
  apr: number
  timestamp: number
}

const saveToCache = (symbol: string, data: CacheEntry) => {
  localStorage.setItem(symbol, JSON.stringify(data))
}

const loadFromCache = (symbol: string): CacheEntry | null => {
  const cachedData = localStorage.getItem(symbol)
  if (!cachedData) return null

  const entry = JSON.parse(cachedData)
  const currentTime = Date.now() / 1000

  if (currentTime - entry.timestamp > 86400) {
    return null
  }

  return entry
}

const stETH = async (): Promise<CacheEntry> => {
  type Response = {
    data: {
      timeUnix: number
      apr: number
    }
  }

  const response = (await fetch("https://eth-api.lido.fi/v1/protocol/steth/apr/last").then((res) => res.json())) as Response

  return { apr: response.data.apr, timestamp: response.data.timeUnix }
}

const stMATIC = async (): Promise<CacheEntry> => {
  type Response = {
    apr: number
  }

  const response = (await fetch("https://pol-api-pub.lido.fi/stats").then((res) => res.json())) as Response

  return { apr: response.apr, timestamp: Date.now() / 1000 }
}

const rETH = async (): Promise<CacheEntry> => {
  type Response = {
    rethAPR: number
  }

  const response = (await fetch("https://rocketpool.net/api/mainnet/payload").then((res) => res.json())) as Response

  return { apr: response.rethAPR, timestamp: Date.now() / 1000 }
}

const maticX = async (): Promise<CacheEntry> => {
  type Response = {
    value: number
  }

  const response = (await fetch("https://universe.staderlabs.com/polygon/apy").then((res) => res.json())) as Response

  return { apr: response.value, timestamp: Date.now() / 1000 }
}

const cbETH = async (): Promise<CacheEntry> => {
  type Response = {
    apy: number
  }

  const response = (await fetch("https://api.exchange.coinbase.com/wrapped-assets/CBETH").then((res) => res.json())) as Response

  return { apr: response.apy * 100, timestamp: Date.now() / 1000 }
}

const fetchData = async (symbol: string): Promise<CacheEntry> => {
  switch (symbol.toUpperCase()) {
    case "STETH":
    case "WSTETH":
      return await stETH()
    case "RETH":
      return await rETH()
    case "MATICX":
      return await maticX()
    case "STMATIC":
      return await stMATIC()
    case "CBETH":
      return await cbETH()
    default:
      return { apr: 0, timestamp: 0 }
  }
}

export const useBearingAPR = (symbol: string) => {
  const [data, setData] = useState(0n)

  useEffect(() => {
    const cachedData = loadFromCache(symbol)

    if (cachedData) {
      setData(toBigInt(cachedData.apr))
    } else {
      fetchData(symbol).then((newData) => {
        setData(toBigInt(newData.apr))
        saveToCache(symbol, newData)
      })
    }
  }, [symbol])

  return data
}

const toBigInt = (num: number) => BigInt(num * 1e16)
