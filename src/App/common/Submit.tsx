import { SignedPermit, signERC2612Permit, SupportedChainIds } from "@/api/chain"
import { FormMessage } from "@/components/messaging/FormMessage"
import { IconType } from "@/components/NotificationIcon"
import { ILinkedOrder, useApproval, useTrade } from "@/hooks/useTrade"
import { MAX_INT_256 } from "@/utils/constants"
import { mulDiv } from "@/vivex-xyz/sdk"
import React, { useEffect, useState } from "react"
import { Hex } from "viem"
import { useWalletClient } from "wagmi"
import { QuoteSwapMapped } from "../common"
import { btn, WithAllowance } from "../common/components"

const getBtnText = ({
  quote: {
    meta: { normalisedBalances },
    tradeQuantity,
  },
}: QuoteSwapMapped) => {
  return normalisedBalances.collateral === 0n ? "Submit Trade" : tradeQuantity === -MAX_INT_256 ? "Close Position" : "Update Position"
}

const SubmitTradeBtn: React.FC<{
  onSuccess: () => void
  onError: () => void
  onExcludeFLP: (flp: Hex) => void
  permit?: SignedPermit
  data: QuoteSwapMapped
  linkedOrders: ILinkedOrder[]
}> = ({ permit, onError, onSuccess, onExcludeFLP, data, linkedOrders }) => {
  const { write, isLoading, isError, isSuccess, reset, allFailed } = useTrade({ ...data, linkedOrders, permit }, onExcludeFLP)

  useEffect(() => {
    if (isSuccess) {
      reset()
      onSuccess()
    }
  }, [isSuccess])

  useEffect(() => {
    if (isError) {
      onError()
    }
  }, [isError])

  return (
    <>
      {btn(() => write?.(), getBtnText(data), !write || isLoading)}
      <FormMessage iconType={IconType.Error} visible={allFailed}>
        {`Trade simulation failed. Unable to submit trade`}
      </FormMessage>
    </>
  )
}

export const SubmitTrade: React.FC<{
  onSuccess: () => void
  data: QuoteSwapMapped
  linkedOrders: ILinkedOrder[]
  onExcludeFLP: (flp: Hex) => void
}> = ({ data, linkedOrders, onSuccess, onExcludeFLP }) => {
  const { quote } = data
  const { cashflow } = quote
  const { nonce } = useApproval(data)
  const { data: walletClient } = useWalletClient()
  const [isSigningPermit, setIsSigningPermit] = useState(false)
  const [permit, setPermit] = useState<SignedPermit | undefined>()

  console.log ("quote ===>", quote)

  console.log ("cashflow ===>", cashflow)

  // TODO: Not sure if this is right, but the WithAllowance was not working with native tokens, and it feels it shouldn't be its responsibility to handle that
  if (cashflow.isNative) {
    return <SubmitTradeBtn onSuccess={onSuccess} onExcludeFLP={onExcludeFLP} onError={() => {}} linkedOrders={linkedOrders} data={data} />
  } else {

    return (
      <div className="h-10">
        <WithAllowance
        // @ts-ignore
          permit={permit}
          isSigningPermit={isSigningPermit}
          onSignPermit={(allowanceTarget, usePermit2) => {
            if (walletClient && (nonce !== undefined || usePermit2)) {
              setIsSigningPermit(true)
              signERC2612Permit(
                cashflow.tokenAddress,
                // @ts-ignore
                mulDiv(cashflow.value, BigInt(1.001e18), BigInt(1e18)),
                walletClient.account.address,
                allowanceTarget,
                walletClient.chain.id as SupportedChainIds,
                cashflow.name,
                Number(nonce),
                walletClient,
                usePermit2,
              )
                .then((signedPermit) => {
                  setIsSigningPermit(false)
                  setPermit(signedPermit)
                })
                .catch((err) => {
                  console.error("error signing permit: ", err)
                  setIsSigningPermit(false)
                })
            } else {
              console.error("missing wallet client!")
            }
          }}
          quote={quote}
        >
          <SubmitTradeBtn
            onSuccess={() => {
              setPermit(undefined)
              onSuccess()
            }}
            onExcludeFLP={onExcludeFLP}
            onError={() => setPermit(undefined)}
            linkedOrders={linkedOrders}
            data={data}
            permit={permit}
          />
        </WithAllowance>
      </div>
    )
  }
}
