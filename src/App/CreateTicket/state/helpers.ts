import { SupportedChainIds } from "@/api/chain"
import { CtxInstrumentId, shortIdsSet } from "@/api/graphql/instruments"
import { Side, positionIdMapper } from "@/vivex-xyz/sdk"
import { Hex } from "viem"

export const unwrapInstrumentId = (id: CtxInstrumentId) => {
  const [posId, chain] = id.split("-")
  const chainId: SupportedChainIds = Number(chain) as SupportedChainIds
  const positionId = posId as Hex
  const { mm, symbolHex } = positionIdMapper(positionId)
  return {
    positionId,
    chainId,
    mm,
    side: shortIdsSet.has(symbolHex) ? Side.Short : Side.Long,
  }
}
