import { SignedPermit, SupportedChainIds } from "@/api/chain"
import { ValueOf } from "@/api/graphql/instruments"
import { toDisplayValue } from "@/components/CurrencyDisplay"
import { Loading } from "@/components/Loading"
import { IconType } from "@/components/NotificationIcon"
import { PrimaryButton } from "@/components/PrimaryButton"
import { FormMessage } from "@/components/messaging/FormMessage"
import { useApproval, useHasSufficientBalance } from "@/hooks/useTrade"
import { classNames } from "@/utils/classNames"
import { MAX_INT_256 } from "@/utils/constants"
import { mulDiv } from "@/vivex-xyz/sdk"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid"
import { useModal } from "connectkit"
import React, { PropsWithChildren, useEffect, useRef, useState } from "react"
import { Hex, parseAbi } from "viem"
import { useAccount, useContractWrite, useNetwork, usePrepareContractWrite, useSwitchNetwork, useWaitForTransaction } from "wagmi"
import { QuoteSwapMapped, TradeQuoteMapped } from "."

export const maxQuantityWarning = ({ maxQuantity, pair }: TradeQuoteMapped, quantity: bigint | null, onChange: (value: bigint) => void) => {
  if (quantity === null) return null
  const isAboveMax = quantity > maxQuantity
  const { displayDecimals, decimals } = pair.base
  const cutoff = BigInt(Number(`1e${decimals - displayDecimals}`))
  // @ts-ignore
  const safeMax = (mulDiv(maxQuantity, BigInt(0.99e18), BigInt(1e18)) / cutoff) * cutoff

  return (
    <FormMessage iconType={IconType.Error} testId={"TODO"} visible={isAboveMax}>
      <div className="flex justify-between items-center w-full">
        <span>{`Insufficient liquidity`}</span>
        <PrimaryButton
          className="h-6 w-fit"
          onClick={() => {
            onChange(safeMax)
          }}
        >
          <span className="text-sm">Set to max</span>
        </PrimaryButton>
      </div>
    </FormMessage>
  )
}

export const minQuantityWarning = (pair: TradeQuoteMapped["pair"], quantity: bigint | null, onChange: (value: bigint) => void) => {
  if (!quantity) return null
  const { displayDecimals, decimals } = pair.base
  const baseUnit = 10n ** BigInt(decimals)
  const min = baseUnit / 10n ** BigInt(displayDecimals)
  const isBelowMin = quantity < min

  return (
    <FormMessage iconType={IconType.Error} visible={isBelowMin}>
      <div className="flex justify-between items-center w-full">
        <span>{`Min size ${toDisplayValue(min, pair.base)} ${pair.base.symbol}`}</span>
        <PrimaryButton
          className="h-6 w-fit"
          onClick={() => {
            onChange(min)
          }}
        >
          <span className="text-sm">Set to min</span>
        </PrimaryButton>
      </div>
    </FormMessage>
  )
}

export const btn = (onClick: () => void, text: React.ReactNode, disabled: boolean) => (
  <PrimaryButton className="w-full bg-blue-1" onClick={onClick} disabled={disabled}>
    {text}
  </PrimaryButton>
)

export const ConnectWalletBtn = () => {
  const modal = useModal()
  return (
    <PrimaryButton className="w-full bg-blue-1" onClick={() => modal.setOpen(true)}>
      Connect Wallet
    </PrimaryButton>
  )
}

export const SwitchChainBtn: React.FC<{ chainId: SupportedChainIds }> = ({ chainId }) => {
  const { chains, switchNetwork, isLoading } = useSwitchNetwork()
  const chain = chains.find((chain) => chain.id == chainId)

  return btn(() => switchNetwork?.(chainId), `Switch to ${chain ? chain.name : "Unknown chain"}`, isLoading)
}

interface ArrowProps {
  isExpanded: boolean
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
  testId?: string
  visible?: boolean
}
export const UpDownArrow: React.FC<ArrowProps> = ({ visible = true, isExpanded, onClick, testId }) => (
  <div
    onClick={(e) => {
      e.stopPropagation()
      onClick(e)
    }}
    data-testid={testId}
    className={classNames("h-5 w-5 border-[1.5px] border-backgrounds-300 rounded-xl cursor-pointer", visible ? "" : "hidden")}
  >
    {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
  </div>
)

const OPTIONS_ONE = ["Permit", "Permit 2", "Approval"] as const
const OPTIONS_TWO = ["Permit 2", "Approval"] as const
export const WithAllowance: React.FC<
  PropsWithChildren<
    Pick<QuoteSwapMapped, "quote"> & {
      permit?: SignedPermit
      isSigningPermit: boolean
      onSignPermit: (allowanceTarget: Hex, usePermit2: boolean) => void
    }
  >
> = (props) => {
  const { isSigningPermit, onSignPermit, permit, children } = props
  const { contangoAllowance, permit2Allowance, supportsPermit } = useApproval(props)
  const OPTIONS = supportsPermit ? OPTIONS_ONE : OPTIONS_TWO
  const {
    quote: { cashflow, meta },
  } = props
  const { address } = useAccount()
  const [allowanceOption, setAllowanceTarget] = useState<ValueOf<typeof OPTIONS>>(OPTIONS[0])

  useEffect(() => {
    // forces allowance change if options change
    setAllowanceTarget(OPTIONS[0])
  }, [OPTIONS])

  const ref = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState<boolean>(false)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [setIsOpen])

  const { config } = usePrepareContractWrite({
    abi: parseAbi(["function approve(address _spender, uint256 _value) external"]),
    functionName: "approve",
    address: cashflow.tokenAddress,
    account: address,
    args: [allowanceOption === "Approval" ? cashflow.allowanceTarget : meta.addresses.permit2, MAX_INT_256],
  })

  const contract = useContractWrite(config)
  const { write, isLoading, isError, isSuccess, data, reset } = contract
  const { isLoading: isTxPending } = useWaitForTransaction({ hash: data?.hash, chainId: meta.chainId })
  const [isPendingApproveTx, setIsPendingApproveTx] = useState(false)
  const disabled = !write || isLoading || isTxPending || isSigningPermit || isPendingApproveTx

  const btnText =
    allowanceOption === "Approval" || (allowanceOption === "Permit 2" && permit2Allowance < cashflow.value)
      ? "Approve Spending"
      : "Sign Permit"

  const hasValidSignedPermit = permit && permit.amount >= cashflow.value
  const hasAllowance = contangoAllowance >= cashflow.value

  useEffect(() => {
    if (isSuccess || isError) {
      if (isSuccess) {
        setIsPendingApproveTx(true)
      }
      reset()
    }
  }, [isSuccess, isError])

  useEffect(() => {
    setIsPendingApproveTx(false)
  }, [permit2Allowance, contangoAllowance])

  if (hasValidSignedPermit || hasAllowance) return children

  return (
    <div className="relative" ref={ref}>
      <PrimaryButton
        className="w-full bg-blue-1 pr-0"
        onClick={() => {
          if (allowanceOption === "Permit") {
            onSignPermit(cashflow.allowanceTarget, false)
          } else if (allowanceOption === "Permit 2" && permit2Allowance >= cashflow.value) {
            onSignPermit(meta.addresses.maestroProxy, true)
          } else {
            write?.()
          }
        }}
        disabled={disabled}
      >
        <div className="flex justify-between">
          <span></span>
          <div className="flex gap-2 items-center">
            <span>{btnText}</span>
            {isPendingApproveTx ? <Loading size={15} /> : null}
          </div>
          <span
            className="flex items-center h-10 pr-2"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              if (!disabled) {
                setIsOpen((isOpen) => !isOpen)
              }
            }}
          >
            {isOpen ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
          </span>
        </div>
      </PrimaryButton>
      <div
        className={classNames(
          "text-base border border-functional-buy-500 bg-backgrounds-200 text-white absolute w-full rounded-xl p-2 z-10 ",
          isOpen ? "" : "hidden",
        )}
      >
        {OPTIONS.map((option) => (
          <div
            className="flex flex-row justify-between items-center hover:bg-backgrounds-200 rounded-lg p-2"
            onClick={() => {
              setAllowanceTarget(option)
              setTimeout(() => {
                setIsOpen(false)
              }, 300)
            }}
            key={option}
          >
            <span className="text-sm">{option}</span>
            {allowanceOption === option ? <CheckIcon className="h-5 w-5 text-accents-500" /> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export const WithWalletChainAndBalance: React.FC<PropsWithChildren<QuoteSwapMapped & { fallback: React.ReactNode }>> = ({
  children,
  quote,
  fallback,
}) => {
  const account = useAccount()
  const { chain } = useNetwork()
  const connectedChainId = chain?.id as SupportedChainIds
  const chainId = quote.meta.chainId as SupportedChainIds
  const { tradeQuantity, cashflow } = quote
  const hasDeltas = Boolean(tradeQuantity) || Boolean(cashflow.value)
  const insufficientBalance = useHasSufficientBalance({ quote })

  if (!account.isConnected) return <ConnectWalletBtn />
  if (connectedChainId !== chainId) return <SwitchChainBtn chainId={chainId} />
  if (!hasDeltas) return fallback
  if (insufficientBalance) return btn(() => {}, "Insufficient Balance", true)
  return children
}

export const WithChain: React.FC<PropsWithChildren<{ chainId: SupportedChainIds }>> = ({ chainId, children }) => {
  const { chain } = useNetwork()
  const connectedChainId = chain?.id as SupportedChainIds

  if (connectedChainId != chainId) return <SwitchChainBtn chainId={chainId} />
  return children
}
