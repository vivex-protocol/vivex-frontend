import { chains, chainsMap, contangoSdk, SupportedChainIds } from "@/api/chain"
import {
  formatId,
  GraphPosition,
  invertLimitPrice,
  OrderType,
  queryClaimableRewards,
  queryLatestBlockNo,
  queryNewPosition,
  queryPositions,
} from "@/api/graphql/queries"
import { calculatePnlPercentage } from "@/utils/financial-utils"
import { withLatest } from "@/utils/observable-utils"
import { recordFromEntries } from "@/utils/record-utils"
import { ObservableType } from "@/utils/types"
import { mulDiv, ordersAdded$, ordersRemoved$, positionIdMapper, positionUpsert$ } from "@/vivex-xyz/sdk"
import { sinkSuspense, state, SUSPENSE } from "@react-rxjs/core"
import { mergeWithKey } from "@react-rxjs/utils"
import { combineLatest, concat, filter, from, map, merge, mergeMap, Observable, of, scan, startWith, switchMap } from "rxjs"
import { Hex } from "viem"
import { timeDelay } from "./PositionEdit/state/cost"
import { MoneyMarket } from "@/utils/custom"
type PositionId = Hex
type Owner = Hex
export type CtxPositionId = `${PositionId}-${SupportedChainIds}-${Owner}`

export const unwrapPosId = (id: CtxPositionId): [Hex, SupportedChainIds, Owner] => {
  const [posId, chainId, owner] = id.split("-")

  return [posId as Hex, Number(chainId) as SupportedChainIds, owner as Owner]
}

export const unwrapId = (id: CtxPositionId) => {
  const [positionId, chainId, owner] = unwrapPosId(id)
  const { number, mm } = positionIdMapper(positionId)
  // @ts-ignore
  return { positionId, chainId, owner, number, mm: mm as MoneyMarket }
}
// @ts-ignore
type Update = positionUpsert$ & { chainId: number; blockNumber: bigint }
const positionUpserted$ = state((account: Hex, chainId: SupportedChainIds) => {
  return new Observable<Update>((observer) => {
    const next = observer.next.bind(observer)
    return contangoSdk.positionUpserts$(account, chainId, next)
  })
})

const orderPlaced$ = state((account: Hex, chainId: SupportedChainIds) => {
  // @ts-ignore
  return new Observable<Parameters<ordersAdded$>[0]>((observer) => {
    const next = observer.next.bind(observer)
    return contangoSdk.ordersAdded$(account, chainId, next)
  })
})

const orderRemoved$ = state((chainId: SupportedChainIds) => {
  // @ts-ignore
  return new Observable<Parameters<ordersRemoved$NextFn>[0]>((observer) => {
    const next = observer.next.bind(observer)
    return contangoSdk.ordersRemoved$(chainId, next)
  })
})

const getGraphUrls = (chainId: number) => chains.find((chain) => chain.id == chainId)?.graphUrls!

const MAX_RETRIES = 300
const DELAY_MS = 1000
export function delay(ms = DELAY_MS) {
  return new Promise<void>(function (resolve) {
    setTimeout(resolve, ms)
  })
}

const waitForGraph = async (blockNumber: bigint, urls: string[], retry = 0): Promise<string> => {
  console.log(`Waiting for graph to index block ${blockNumber}...`)

  if (retry > MAX_RETRIES) {
    throw Error(`Graph block number not updated after ${(MAX_RETRIES * DELAY_MS) / 1000}s.`)
  }

  const { chain, block: highWatermark } = await queryLatestBlockNo(urls)
  if (highWatermark < blockNumber) {
    console.log(`Graph latest block number ${highWatermark} is behind ${blockNumber}. Retrying...`)
    return await delay().then(() => waitForGraph(blockNumber, urls, retry + 1))
  }
  return chain
}

export const graphPositions$ = state((account?: Hex) => {
  if (!account) return of({} as Record<CtxPositionId, GraphPosition>)
  return merge(
    ...chains.map((chain) =>
      from(queryPositions(chain.graphUrls, account, chain.id)).pipe(
        switchMap((sotw) => {
          return positionUpserted$(account, chain.id).pipe(
            mergeMap((event) =>
              concat(
                of({
                  id: formatId(event.positionId, event.chainId as SupportedChainIds, event.owner),
                  status: "pendingIndex",
                } as GraphPosition),
                from(
                  waitForGraph(event.blockNumber, getGraphUrls(event.chainId)).then((chainUrl) =>
                    queryNewPosition(chainUrl, chain.id, event.positionId),
                  ),
                ),
              ),
            ),
            startWith(...[...sotw.reverse()]),
          )
        }),
      ),
    ),
  ).pipe(
    scan((acc, curr) => {
      const existing = acc[curr.id]
      if (existing) {
        const copy = { ...acc }

        if (curr.isClosed) {
          delete copy[curr.id]
        } else {
          copy[curr.id] = curr
        }

        return { ...copy }
      }
      return { [curr.id]: curr, ...acc }
    }, {} as Record<CtxPositionId, GraphPosition>),
  )
}, {} as Record<CtxPositionId, GraphPosition>)

export const getPosition$ = state((positionId: CtxPositionId) => {
  const { owner } = unwrapId(positionId)
  return graphPositions$(owner).pipe(
    map((obj) => obj[positionId]),
    switchMap((pos) => (pos && pos.status === "inSync" ? [pos] : of(SUSPENSE))),
    sinkSuspense(),
  )
})
// @ts-ignore
const claimableRewards$ = (chainId: SupportedChainIds, owner: Hex, moneyMarkets: MoneyMarket[]) => {
  const chain = chainsMap.get(chainId as 1)!

  const idsWithRewards$ = withLatest(queryClaimableRewards, 30 * 60_000)(chain.graphUrls, owner, moneyMarkets)
  const idsToPoll$ = mergeWithKey({
    unclaimed: idsWithRewards$,
    // @ts-ignore
    claimed: contangoSdk.rewardsClaimed$(owner, chainId),
  }).pipe(
    scan((acc, { type, payload }) => {
      switch (type) {
        case "unclaimed":
          return payload
        case "claimed":
          return [...acc].filter((id) => !payload.has(id))
      }
    }, [] as Hex[]),
    startWith([] as Hex[]),
  )

  return idsToPoll$.pipe(
    switchMap((ids) =>
      ids.length === 0
        ? of(null)
        : combineLatest(
            ids.map((id) =>
              withLatest(contangoSdk.getRewardsData)(id, chainId).pipe(
                map((rewards) => ({ id, rewards: [...rewards.baseRewards, ...rewards.quoteRewards] })),
              ),
            ),
          ),
    ),
    map((x) => [chainId, x] as const),
  )
}

type Reward = Exclude<ObservableType<ReturnType<typeof claimableRewards$>>[1], null>

export const getClaimableRewards$ = state((owner: Hex) => {
  // @ts-ignore
  return combineLatest([claimableRewards$(10, owner, [MoneyMarket.Exactly]), claimableRewards$(100, owner, [MoneyMarket.Aave])]).pipe(
    map((x) => {
      const arr = x
        .filter((args): args is [SupportedChainIds, Reward] => Boolean(args[1]))
        .map(([chainId, vals]) => {
          // @ts-ignore
          const ids = vals.map((x) => x.id)

          const rewards = vals
          // @ts-ignore
            .flatMap(({ rewards }) => rewards)
            .reduce((acc, { token: { symbol }, claimable, usdPrice }) => {
              const current = acc[symbol] || { claimable: 0, usdValue: 0 }

              return {
                ...acc,
                [symbol]: {
                  claimable: current.claimable + Number(claimable) / 1e18,
                  usdValue: current.usdValue + Number(mulDiv(claimable, usdPrice, BigInt(1e18))) / 1e18,
                },
              }
            }, {} as Record<string, { claimable: number; usdValue: number }>)

          return [chainId, { ids, rewards }] as const
        })

      return recordFromEntries(arr)
    }),
  )
})

type Order = GraphPosition["orders"][0]

export const getLinkedOrders$ = state((id: CtxPositionId) =>
  getPosition$(id).pipe(
    switchMap((position) => {
      const init = Object.fromEntries(position.orders.map((x) => [x.orderId.toLowerCase(), x] as const))
      const { chainId, owner, positionId } = unwrapId(id)
      // @ts-ignore
      const added$ = orderPlaced$(owner, chainId).pipe(filter((x) => x.positionId?.toLowerCase() === positionId))
      const removed$ = orderRemoved$(chainId)

      return mergeWithKey({
        added: added$,
        removed: removed$,
      }).pipe(
        scan((acc, { type, payload }) => {
          if (type === "added") {
            const order: Order = {
              // @ts-ignore
              orderId: payload.orderId,
              // @ts-ignore
              type: payload.orderType as OrderType,
              // @ts-ignore
              limitPrice: invertLimitPrice(payload.limitPrice, position.instrument),
            }
            return { ...acc, [order.orderId.toLowerCase()]: order }
          }
          if (type === "removed") {
            const copy = { ...acc }
            // @ts-ignore
            delete copy[payload.orderId.toLowerCase()]
            return copy
          }
          return acc
        }, init),
        startWith(init),
      )
    }),
    map((ordersMap) => {
      const orders = Object.values(ordersMap)
      // @ts-ignore
      const [takeProfit] = orders.filter((x) => x.type === OrderType.TakeProfit).sort((a, b) => Number(a.limitPrice - b.limitPrice))
      // @ts-ignore
      const [stopLoss] = orders.filter((x) => x.type === OrderType.StopLoss).sort((a, b) => Number(b.limitPrice - a.limitPrice))

      return {
        takeProfit: takeProfit ? takeProfit : null,
        stopLoss: stopLoss ? stopLoss : null,
      }
    }),
  ),
)

export const getPositionStatus$ = state((id: CtxPositionId) =>
  getPosition$(id).pipe(
    switchMap((position) => {
      const { positionId, chainId } = unwrapId(id)
      return withLatest(contangoSdk.positionStatus, timeDelay)(positionId, position.instrument.side, chainId).pipe(
        map((status) => {
          // @ts-ignore
          const pnl = status.equity - position.cashflow - status.closingFee - position.realisedPnL
          const pnlPercentage = calculatePnlPercentage(position.cashflow, pnl)
          return {
            ...status,
            fees: position.fees,
            pnl,
            // @ts-ignore
            rawPnl: status.equity + position.fees - position.cashflow,
            pnlPercentage,
            leverage: Number(status.leverage) / 1e8,
            margin: Number(status.margin) / 1e6,
            minMargin: Number(status.minMargin) / 1e6,
          }
        }),
      )
    }),
  ),
)
