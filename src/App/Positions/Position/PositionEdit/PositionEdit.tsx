import { Cashflow } from "@/App/common/Margin"
import { SecondaryButton } from "@/components/SecondaryButton"
import { classNames } from "@/utils/classNames"
import { absolute } from "@/vivex-xyz/sdk"
import { Subscribe, state, useStateObservable } from "@react-rxjs/core"
import React, { Suspense } from "react"
import { combineLatest, map, merge } from "rxjs"
import { usePositionContext } from "../Position.context"
import { PositionDialog } from "../PositionDialog"
import { CtxPositionId, getPosition$ } from "../queries"
import { PositionEditLeverageSlider } from "./LeverageSlider"
import { LinkedOrders } from "./LinkedOrders"
import { PositionHeaderNew } from "./PositionHeader"
import { Quantity, Quantity$ } from "./Quantity"
import { Submit } from "./Submit"
import { EditPositionSummary } from "./Summary/ResultingPositionSummary"
import { EditType, onEditOrCancel, positionEditFlow$ } from "./state/base"
import { loadingPriceQuote$, nsPriceQuotes$ } from "./state/cost"
import { onSelectedCashflowCcy, selectedCashflowCcy$ } from "./state/inputs"
import { isClosingPosition$ } from "./state/quantity"

const editPositionPayment$ = state(
  (id: CtxPositionId) =>
    combineLatest([nsPriceQuotes$(id), loadingPriceQuote$(id), getPosition$(id), selectedCashflowCcy$(id)]).pipe(
      map(([quotes, loading, position, selectedCashflowCcy]) => {
        const normalisedCashflow = quotes.base.collateralDelta - quotes.base.debtDelta
        if (absolute(normalisedCashflow) > BigInt(quotes.base.meta.normalisedBalances.unit)) {
          return (
            <div className={classNames("flex flex-col gap-2 text-base px-4", loading ? "blur-sm" : "")}>
              <span className="px-2 text-fontColor-500 text-sm">{quotes.base.cashflow.value > 0n ? "You Deposit" : "You Receive"}</span>
              <Cashflow
                address={position.owner}
                selectedCashflowCcy={selectedCashflowCcy}
                quotes={quotes}
                setSelectedCashflowCcy={(key) => onSelectedCashflowCcy(id, key)}
              />
            </div>
          )
        }
        return null
      }),
    ),
  null,
)

export const PositionEdit$ = state((id: CtxPositionId) => merge(positionEditFlow$(id), isClosingPosition$(id), editPositionPayment$(id)))
export const PositionEdit: React.FC = () => {
  const position = usePositionContext()
  const flowType = useStateObservable(positionEditFlow$(position.id))
  const isClosing = useStateObservable(isClosingPosition$(position.id))

  return (
    <Suspense fallback={null}>
      <div className="bg-backgrounds-100 rounded-lg inline-block w-full border border-backgrounds-300">
        <div className="font-primary m-4 max-w-[350px] flex flex-col gap-3">
          <PositionHeaderNew />
          {flowType === EditType.edit ? (
            <Subscribe source$={Quantity$(position.id)}>
              <Quantity />
            </Subscribe>
          ) : null}
          {isClosing ? null : <PositionEditLeverageSlider />}
        </div>
        <div className="m-4">
          <EditPositionSummary />
        </div>
        {editPositionPayment$(position.id)}
        <div className="m-4 gap-2 flex flex-col">
          <Submit />
          <SecondaryButton
            className="w-full"
            testId="position-edit--cancel-button"
            onClick={() => {
              onEditOrCancel(position.id, EditType.none)
            }}
          >
            Cancel
          </SecondaryButton>
        </div>
      </div>
    </Suspense>
  )
}

export const PositionDialogContainer: React.FC = () => {
  const position = usePositionContext()
  const flowType = useStateObservable(positionEditFlow$(position.id))

  return (
    <PositionDialog onClose={() => onEditOrCancel(position.id, EditType.none)} isOpen={flowType !== EditType.none}>
      {flowType === EditType.edit || flowType === EditType.close ? <PositionEdit /> : null}
      {flowType === EditType.linkedOrders ? (
        <Suspense fallback={null}>
          <LinkedOrders />
        </Suspense>
      ) : null}
    </PositionDialog>
  )
}
