import { LeverageEdit } from "@/components/Leverage"
import { IconType } from "@/components/NotificationIcon"
import { FormMessage } from "@/components/messaging/FormMessage"
import { useStateObservable } from "@react-rxjs/core"
import { Fragment } from "react"
import { nsPriceQuote$, selectedPair$ } from "./state"
import { leverageInput$, onLeverageInputChanged } from "./state/inputs"
import { maxLeverageUnavTestId } from "./testIds"

export const Leverage: React.FC = () => {
  const { upperBound, maxLeverage } = useStateObservable(nsPriceQuote$)
  const leverage = useStateObservable(leverageInput$)
  const pair = useStateObservable(selectedPair$)

  let tmpMaxLeverage = pair.symbol === "DAI/USDT"? 101 : maxLeverage

  const props = {
    min: 1,
    max: tmpMaxLeverage,
    value: leverage,
    lowerBound: 1,
    upperBound: tmpMaxLeverage,
    testIdPrefix: "create-ticket",
  }

  return (
    <Fragment key="create-ticket-equity-module">
      <LeverageEdit {...props} onChange={(leverage) => onLeverageInputChanged(leverage)} />
      <FormMessage testId={maxLeverageUnavTestId} iconType={IconType.Warning} visible={props.upperBound * 1.01 < props.max}>
        <span>The maximum leverage for this instrument is unavailable due to insufficient borrowing liquidity.</span>
      </FormMessage>
    </Fragment>
  )
}
