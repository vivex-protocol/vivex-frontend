import { SECONDS_IN_HOUR, SECONDS_IN_YEAR } from "./constants"
import { roundTo } from "./rounding"

export const basisRateEquivalent = (basisRate: number, secondsTilExpiry: number, interval: "1h" | "4h" | "8h" | "365d") => {
  switch (interval) {
    case "1h":
      return roundTo((SECONDS_IN_HOUR / secondsTilExpiry) * basisRate, 6)
    case "4h":
      return roundTo(((SECONDS_IN_HOUR * 4) / secondsTilExpiry) * basisRate, 5)
    case "8h":
      return roundTo(((SECONDS_IN_HOUR * 8) / secondsTilExpiry) * basisRate, 5)
    case "365d":
      return roundTo((SECONDS_IN_YEAR / secondsTilExpiry) * basisRate, 2)
  }
}

export const formatDateUTC = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  return date.toUTCString().substring(4)
}

export const formatDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString() + " " + date.toLocaleTimeString()
}
