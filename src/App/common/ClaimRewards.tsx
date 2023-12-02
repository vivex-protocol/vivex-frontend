import { SupportedChainIds } from "@/api/chain"
import { AssetSymbol, assets } from "@/api/graphql/instruments"
import { toDisplayValue } from "@/components/CurrencyDisplay"
import { CurrencyIcon } from "@/components/CurrencyIcon"
import { Loading } from "@/components/Loading"
import { PrimaryButton } from "@/components/PrimaryButton"
import { classNames } from "@/utils/classNames"
import { recordEntries } from "@/utils/record-utils"
import { contangoABI, getContangoProxy } from "@/vivex-xyz/sdk"
import { Dialog, Transition } from "@headlessui/react"
import { useStateObservable } from "@react-rxjs/core"
import { Fragment, useEffect, useMemo, useState } from "react"
import { Hex, encodeFunctionData } from "viem"
import { useAccount, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from "wagmi"
import { idToLogo, idToNameMap } from "../CreateTicket"
import { getClaimableRewards$ } from "../Positions/Position/queries"
import { WithChain, btn } from "./components"

const ChainRewards: React.FC<{
  account: Hex
  chainId: SupportedChainIds
  ids: Hex[]
  rewards: Record<string, { claimable: number; usdValue: number }>
}> = ({ rewards, ids, account, chainId }) => {
  const contangoAddress = useMemo(() => getContangoProxy(chainId), [chainId])

  const { config } = usePrepareContractWrite({
    abi: contangoABI,
    functionName: "multicall",
    address: contangoAddress,
    account,
    args: [
      ids.map((positionId) =>
        encodeFunctionData({
          abi: contangoABI,
          functionName: "claimRewards",
          args: [positionId, account],
        }),
      ),
    ],
    chainId,
  })
  const contract = useContractWrite(config)
  const { write, isLoading, data, reset } = contract
  const { isLoading: isTxPending, isError, isSuccess: isTxSuccess } = useWaitForTransaction({ hash: data?.hash, chainId })
  const showSpinner = isTxPending || isTxSuccess

  useEffect(() => {
    // in case of success, the event will be emitted and the whole section will stop being rendered so no need to do any handling here
    if (isError) {
      reset()
    }
  }, [isError])

  const totalUsd = Object.values(rewards).reduce((acc, curr) => curr.usdValue + acc, 0)

  return (
    <div className={classNames("flex relative flex-col gap-2 text-secondary-01 text-sm py-2 px-4 bg-backgrounds-200 rounded-lg")}>
      <span className="flex gap-2 font-medium items-center">
        {`Unclaimed on ${idToNameMap[chainId]}`}
        {idToLogo(chainId)}
      </span>
      <div className={classNames(showSpinner ? "absolute left-1/2 top-[calc(50%-40px)]" : "hidden")}>
        <Loading size={20} />
      </div>
      {
        <ul className={classNames("divide-y divide-fontColor-600", showSpinner ? "blur-sm" : "")}>
          <li key={`rewards-${chainId}-header`} className="flex py-3 text-end">
            <span className="basis-2/4 text-start">Token</span>
            <span className="basis-1/4">Amount</span>
            <span className="basis-1/4">{`Value (USD)`}</span>
          </li>
          {Object.entries(rewards)
            .sort(([, { usdValue: a }], [, { usdValue: b }]) => b - a)
            .map(([symbol, { claimable, usdValue }], index) => (
              <li key={index} className="flex py-3 items-center w-full text-end">
                <span className="flex items-center gap-2 font-medium basis-2/4 whitespace-nowrap">
                  <CurrencyIcon currency={symbol} />
                  {symbol}
                </span>
                <span className="basis-1/4">{toDisplayValue(claimable, { ...assets[symbol as AssetSymbol], displayDecimals: 6 })}</span>
                <span className="basis-1/4">{`$${toDisplayValue(usdValue, { decimals: 2, displayDecimals: 2 })}`}</span>
              </li>
            ))}
          <li key={`rewards-usd-total-${chainId}`} className="flex text-end py-3 italic">
            <span className="basis-3/4">{"Total Value (USD)"}</span>
            <span className="basis-1/4">{`$${toDisplayValue(totalUsd, { decimals: 2, displayDecimals: 2 })}`}</span>
          </li>
        </ul>
      }
      <div className="flex w-full justify-end">
        <div className="min-w-fit w-1/2">
          <WithChain chainId={chainId}>{btn(() => write?.(), `Claim`, !write || isLoading || ids?.length === 0 || showSpinner)}</WithChain>
        </div>
      </div>
    </div>
  )
}

export const ClaimRewards: React.FC = () => {
  const { address } = useAccount()
  const account = address ? (address.toLowerCase() as Hex) : address!
  const [isOpen, setIsOpen] = useState<boolean>(false)

  const closeModal = () => {
    setIsOpen(false)
  }

  const openModal = () => {
    setIsOpen(true)
  }

  const rewards = useStateObservable(getClaimableRewards$(account))

  const totalUsdRewards = Object.values(rewards)
    .flatMap((x) => Object.values(x.rewards))
    // @ts-ignore
    .reduce((acc, curr) => curr.usdValue + acc, 0)
// @ts-ignore
  return totalUsdRewards > 0 ? (
    <>
      {/* Button to trigger opening the modal */}
      <PrimaryButton onClick={openModal} className="w-full rounded-md bg-backgrounds-100 text-white px-4 py-2 text-sm">
        {
          // @ts-ignore
          `Claim Your Rewards ($${toDisplayValue(totalUsdRewards, { decimals: 2, displayDecimals: 2 }, { dust: true })})`
        }
      </PrimaryButton>

      {/* The actual modal */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={closeModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform border border-1 border-backgrounds-300 overflow-hidden rounded-2xl p-4 text-left align-middle shadow-xl transition-all bg-backgrounds-100">
                  <Dialog.Title as="div" className="text-lg flex justify-between mb-3 px-2 font-medium leading-6 text-secondary-01">
                    <span>Claim Your Rewards</span>
                    <svg
                      style={{ cursor: "pointer" }}
                      onClick={closeModal}
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </Dialog.Title>
                  {/* Your content goes here */}
                  <div className="flex flex-col gap-5">
                    {recordEntries(rewards).map(([chainId, { ids, rewards }]) => (
                      <ChainRewards key={chainId} account={account} ids={ids} rewards={rewards} chainId={Number(chainId) as any} />
                    ))}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  ) : null
}
