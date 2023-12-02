import { absolute } from "@/vivex-xyz/sdk"
import { roundToTwo } from "./rounding"

export const calculatePnlPercentage = (openCost: bigint, pnl: bigint) => {
  const absOpenCost = Number(absolute(openCost))
  const res = roundToTwo(((absOpenCost + Number(pnl)) / absOpenCost - 1) * 100)
  return Number.isNaN(res) ? 0 : res
}
