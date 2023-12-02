import { LeverageEdit } from "@/components/Leverage"
import { IconType } from "@/components/NotificationIcon"
import { FormMessage } from "@/components/messaging/FormMessage"
import { unsuspended } from "@/utils/observable-utils"
import { withPrefix } from "@/utils/test-utils"
import { state, useStateObservable } from "@react-rxjs/core"
import { Fragment } from "react"
import { merge } from "rxjs"
import { usePositionContext } from "../Position.context"
import { CtxPositionId } from "../queries"
import { nsPriceQuote$ } from "./state/cost"
import { formErrors$, hasCriticalError$ } from "./state/errors"
import { leverageInput$, onLeverageInputChanged } from "./state/inputs"
import { hasLeverageDelta$, leverageValue$ } from "./state/leverage"

const testIdPrefix = "edit-position"

export const PositionEditLeverageSlider$ = state((positionId: CtxPositionId) =>
  unsuspended(
    merge(
      nsPriceQuote$(positionId),
      leverageValue$(positionId),
      hasLeverageDelta$(positionId),
      leverageInput$(positionId),
      hasCriticalError$(positionId),
      formErrors$(positionId, "deltaCost"),
    ),
  ),
)

export const PositionEditLeverageSlider: React.FC = () => {
  const { id } = usePositionContext()

  const leverage = useStateObservable(leverageValue$(id))
  const { upperBound, maxLeverage } = useStateObservable(nsPriceQuote$(id))

  const props = {
    min: 1,
    max: maxLeverage,
    value: leverage,
    lowerBound: 1,
    upperBound: upperBound,
    testIdPrefix: "create-ticket",
  }

  return (
    <Fragment key={`leverage-slider-${id.toString()}`}>
      <LeverageEdit
        {...props}
        onChange={(leverage: number) => {
          onLeverageInputChanged(id, leverage)
        }}
      />
      <FormMessage
        testId={withPrefix("max-leverage-unavailable", testIdPrefix)}
        iconType={IconType.Warning}
        visible={props.upperBound * 1.01 < props.max}
      >
        <span>
          The maximum leverage for this instrument is unavailable. This can be due to insufficient liquidity or exceeding debt limits.
        </span>
      </FormMessage>
    </Fragment>
  )
}
