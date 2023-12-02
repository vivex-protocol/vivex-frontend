import { QuoteSwapMapped } from "@/App/common"
import { SignedPermit } from "@/api/chain"
import { OrderType } from "@/api/graphql/queries"
import { ierc20MetadataABI, ierc20PermitABI, maestroABI } from "@/vivex-xyz/sdk"
import { useEffect, useState } from "react"
import { EncodeFunctionDataParameters, Hex, encodeFunctionData } from "viem"
import { useAccount, useBalance, useContractRead, useContractWrite, usePrepareContractWrite } from "wagmi"
import { CashflowCurrency } from "../utils/custom"

type MaestroFnParams = EncodeFunctionDataParameters<typeof maestroABI>

export interface ILinkedOrder {
  orderType: OrderType
  limitPrice: bigint
  cashflowCcy: CashflowCurrency
  deadline: number
  tolerance: bigint
}

type Params = QuoteSwapMapped & { permit?: SignedPermit; linkedOrders: ILinkedOrder[] }
type TradeParams = MaestroFnParams & { value?: bigint }

const getParams = (data: Params, owner?: Hex): TradeParams[] => {
  const { permit, quote, trades, linkedOrders } = data
  const { cashflow } = quote
  console.log (data, ">>>>")

  if (permit) {
    const { isPermit2, ...signedPermit } = permit
    if (cashflow.value > 0n) {
      if (isPermit2) {
        return trades.map((trade): TradeParams => {
          const bytes: Hex[] = [
            encodeFunctionData({
              abi: maestroABI,
              functionName: "depositWithPermit2",
              args: [cashflow.tokenAddress, signedPermit],
            }),
          ]
          if (linkedOrders.length === 0) {
            bytes.push(
              encodeFunctionData({
                abi: maestroABI,
                functionName: "trade",
                args: [trade.tradeParams, trade.execParams],
              }),
            )
          } else if (linkedOrders.length === 1) {
            bytes.push(
              encodeFunctionData({
                abi: maestroABI,
                functionName: "tradeAndLinkedOrder",
                args: [trade.tradeParams, trade.execParams, linkedOrders[0]],
              }),
            )
          } else if (linkedOrders.length === 2) {
            bytes.push(
              encodeFunctionData({
                abi: maestroABI,
                functionName: "tradeAndLinkedOrders",
                args: [trade.tradeParams, trade.execParams, linkedOrders[0], linkedOrders[1]],
              }),
            )
          }
          return { abi: maestroABI, functionName: "multicall", args: [bytes] }
        })
      } else {
        if (linkedOrders.length === 1) {
          return trades.map(
            (trade): TradeParams => ({
              abi: maestroABI,
              functionName: "depositTradeAndLinkedOrderWithPermit",
              args: [trade.tradeParams, trade.execParams, linkedOrders[0], signedPermit],
            }),
          )
        } else if (linkedOrders.length === 2) {
          return trades.map(
            (trade): TradeParams => ({
              abi: maestroABI,
              functionName: "depositTradeAndLinkedOrdersWithPermit",
              args: [trade.tradeParams, trade.execParams, linkedOrders[0], linkedOrders[1], signedPermit],
            }),
          )
        } else {
          return trades.map(
            (trade): TradeParams => ({
              abi: maestroABI,
              functionName: "depositAndTradeWithPermit",
              args: [trade.tradeParams, trade.execParams, signedPermit],
            }),
          )
        }
      }
    } else {
      throw new Error("unexpected permit for a lte 0 cashflow trade")
    }
  } else {
    if (cashflow.value > 0n) {
      const value = cashflow.isNative ? cashflow.value : 0n
      if (linkedOrders.length === 1) {
        return trades.map(
          (trade): TradeParams => ({
            abi: maestroABI,
            functionName: "depositTradeAndLinkedOrder",
            args: [trade.tradeParams, trade.execParams, linkedOrders[0]],
            value,
          }),
        )
      } else if (linkedOrders.length === 2) {
        return trades.map(
          (trade): TradeParams => ({
            abi: maestroABI,
            functionName: "depositTradeAndLinkedOrders",
            args: [trade.tradeParams, trade.execParams, linkedOrders[0], linkedOrders[1]],
            value,
          }),
        )
      }
      return trades.map(
        (trade): TradeParams => ({ abi: maestroABI, functionName: "depositAndTrade", args: [trade.tradeParams, trade.execParams], value }),
      )
    } else if (cashflow.value < 0n) {
      const functionName = cashflow.isNative ? "tradeAndWithdrawNative" : "tradeAndWithdraw"
      return trades.map((trade): TradeParams => ({ abi: maestroABI, functionName, args: [trade.tradeParams, trade.execParams, owner!] }))
    } else {
      return trades.map((trade): TradeParams => ({ abi: maestroABI, functionName: "trade", args: [trade.tradeParams, trade.execParams] }))
    }
  }
}

export const useTrade = (data: Params, onExcludeFLProvider: (flp: Hex) => void) => {
  const [idx, setIdx] = useState(0)
  const { address: account } = useAccount()
  const tradeParams = getParams(data, account)
  const [allFailed, setAllFailed] = useState(false)

  const { config, error } = usePrepareContractWrite({
    address: data.quote.meta.addresses.maestroProxy,
    account,
    ...(tradeParams[idx] as any),
  })

  const contract = useContractWrite(config)

  useEffect(() => {
    if (error) {
      // this means we're already at the end of the array and they all failed the simulation
      if (idx === tradeParams.length - 1) {
        const alreadyExcluded = data.quote.params.params.excludedFlashloanProviders || new Set()
        const currentFLP = data.trades[0].execParams.flashLoanProvider
        if (alreadyExcluded.size < data.quote.meta.addresses.flashloanProviders.length - 1) {
          // exclude the last one used
          onExcludeFLProvider(currentFLP)
        } else {
          // if we get to here it means we've already tried all flashloan providers and every single trade errored.
          setAllFailed(true)
        }
      } else {
        setIdx((prev) => Math.min(prev + 1, tradeParams.length - 1))
      }
    }
  }, [error])

  return { ...contract, allFailed }
}

const useAllowance = ({
  account,
  chainId,
  allowanceTarget,
  address,
}: {
  account?: Hex
  chainId?: number
  address: Hex
  allowanceTarget: Hex
}) => {
  const { data: allowance } = useContractRead({
    abi: ierc20MetadataABI,
    functionName: "allowance",
    address,
    args: [account!, allowanceTarget],
    watch: true,
    chainId,
  })

  return allowance === undefined ? 0n : allowance
}

export const useApproval = ({ quote }: Pick<QuoteSwapMapped, "quote">) => {
  const { chainId, addresses } = quote.meta
  const { cashflow } = quote
  const { address: account } = useAccount()
  const contangoAllowance = useAllowance({ chainId, account, allowanceTarget: cashflow.allowanceTarget, address: cashflow.tokenAddress })
  const permit2Allowance = useAllowance({ chainId, account, allowanceTarget: addresses.permit2, address: cashflow.tokenAddress })

  const { isError: permitNotSupported, data } = useContractRead({
    abi: ierc20PermitABI,
    functionName: "nonces",
    address: quote.cashflow.tokenAddress,
    args: [account!],
    chainId,
  })
  const isDaiOnMainnet = chainId === 1 && cashflow.tokenAddress.toLowerCase() === "0x6b175474e89094c44da98b954eedeac495271d0f"

  // TODO sometimes `permitNotSupported` is false, but data is undefined. Checking data is a hack to prevent the error from showing up
  const supportsPermit = !permitNotSupported && !isDaiOnMainnet && data !== undefined

  return { contangoAllowance, permit2Allowance, supportsPermit, nonce: data }
}

export const useHasSufficientBalance = ({ quote }: Pick<QuoteSwapMapped, "quote">) => {
  const {
    cashflow: { value, isNative, tokenAddress: token },
    meta: { chainId },
  } = quote
  const { address } = useAccount()

  const { data: erc20Balance } = useBalance({
    address,
    token,
    chainId,
    watch: true,
  })

  const { data: nativeBalance } = useBalance({
    address,
    chainId,
    watch: true,
  })

  const insufficientNativeBalance = isNative && nativeBalance && value > nativeBalance.value
  const insufficientErc20Balance = erc20Balance !== undefined && erc20Balance.value < value

  const insufficientBalance = isNative ? insufficientNativeBalance : insufficientErc20Balance

  return insufficientBalance
}
