import { useStateObservable } from "@react-rxjs/core"
import { Suspense } from "react"
import { btn, WithWalletChainAndBalance } from "../common/components"
import { SubmitTrade } from "../common/Submit"
import { linkedOrders$ } from "./LinkedOrders"
import { onExcludeFLProvider, onResetForm, tradeQuotes$ } from "./state"

export const SubmitInner = () => {
  const data = useStateObservable(tradeQuotes$)
  const linkedOrders = useStateObservable(linkedOrders$)
  return (
    <WithWalletChainAndBalance {...data} fallback={fallback}>
      <SubmitTrade onExcludeFLP={onExcludeFLProvider} data={data} linkedOrders={linkedOrders} onSuccess={onResetForm} />
    </WithWalletChainAndBalance>
  )
}

const fallback = btn(() => {}, "Submit Trade", true)

export const Submit = () => {
  return (
    <Suspense fallback={fallback}>
      <SubmitInner />
    </Suspense>
  )
}
