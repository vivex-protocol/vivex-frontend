import { SubmitTrade } from "@/App/common/Submit"
import { WithWalletChainAndBalance, btn } from "@/App/common/components"
import { ILinkedOrder } from "@/hooks/useTrade"
import { SUSPENSE, state, useStateObservable } from "@react-rxjs/core"
import { Suspense } from "react"
import { combineLatest, map } from "rxjs"
import { usePositionContext } from "../Position.context"
import { CtxPositionId } from "../queries"
import { EditType, onEditOrCancel } from "./state/base"
import { onExcludeFLProvider, tradeQuotes$ } from "./state/cost"
import { hasLeverageDelta$ } from "./state/leverage"
import { quantityDelta$ } from "./state/quantity"

const hasDeltas$ = state((id: CtxPositionId) =>
  combineLatest([quantityDelta$(id), hasLeverageDelta$(id)]).pipe(
    map(([qtyDelta, leverageDelta]) => Boolean(qtyDelta) || leverageDelta),
    map((bool) => bool || SUSPENSE),
  ),
)

export const SubmitInner = () => {
  const { id } = usePositionContext()
  const data = useStateObservable(tradeQuotes$(id))
  useStateObservable(hasDeltas$(id))
  return (
    <WithWalletChainAndBalance {...data} fallback={fallback}>
      <SubmitTrade
        onExcludeFLP={(flp) => onExcludeFLProvider(id, flp)}
        data={data}
        linkedOrders={[] as ILinkedOrder[]}
        onSuccess={() => onEditOrCancel(id, EditType.none)}
      />
    </WithWalletChainAndBalance>
  )
}

const fallback = btn(() => {}, "Update Position", true)

export const Submit = () => {
  return (
    <Suspense fallback={fallback}>
      <SubmitInner />
    </Suspense>
  )
}
