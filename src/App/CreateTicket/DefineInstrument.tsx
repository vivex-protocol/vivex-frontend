import { BuySellTabButton } from "@/components/Tabs"
import { Side } from "@/utils/custom"
import { Subscribe, useStateObservable } from "@react-rxjs/core"
import { merge } from "rxjs"
import { CurrencyPairDropdown, CurrencyPairDropdown$ } from "./CurrencyPairDropdown"
import { onSideChanged, selectedId$, selectedPair$ } from "./state"

const tabOnClick = (side: Side) => () => {
  // onResetForm()
  onSideChanged(side)
}

const BuySellTabs = () => {
  const { selectedSide } = useStateObservable(selectedId$)
  const pair = useStateObservable(selectedPair$)
  return (
    <div className="flex gap-1">
      <BuySellTabButton
        className={selectedSide === "Short" ? "bg-functional-sell-500" : "bg-backgrounds-200"}
        // @ts-ignore
        onClick={tabOnClick("Short")}
        testId={`selectedSide-${Side.Short}`}
        isDisabled={pair.Short.length === 0}
      >
        Sell / Short
      </BuySellTabButton>
      <BuySellTabButton
        className={selectedSide === "Long" ? "bg-blue-1" : "bg-backgrounds-200"}
        // @ts-ignore
        onClick={tabOnClick("Long")}
        testId={`selectedSide-${Side.Long}`}
      >
        Buy / Long
      </BuySellTabButton>
    </div>
  )
}

const sources = merge(CurrencyPairDropdown$, selectedId$, selectedPair$)
export const DefineInstrument = () => (
  <div className="flex flex-col text-secondary-01 gap-3" data-testid="create-ticket--define-instrument">
    <Subscribe fallback={"No Instrument selector"} source$={sources}>
      <CurrencyPairDropdown />
      <BuySellTabs />
    </Subscribe>
  </div>
)
