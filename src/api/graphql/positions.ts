import { ReturnPromiseType } from "@/utils/types"
import { from } from "rxjs"
import { SupportedChainIds } from "../chain"
import { queryHistoryItems } from "./queries"

export const getHistoryItems = (
  filters: Partial<{ trader: string; positionId: string }>,
  endpoints: string[],
  chainId: SupportedChainIds,
) => {
  return from(queryHistoryItems(endpoints, filters, chainId))
}

export type HistoryItem = ReturnPromiseType<typeof queryHistoryItems>[0]
