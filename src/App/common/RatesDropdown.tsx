import { DropDown } from "@/components/DropDown"
import { DropDownOption } from "@/components/DropDownOption"
import { Tooltip } from "@/components/Tooltip"
import { tooltipMapper } from "@/components/tooltipContent"
import { createSignalState } from "@/utils/observable-utils"
import { recordEntries } from "@/utils/record-utils"
import { useStateObservable } from "@react-rxjs/core"
import { RateOptions } from "../common"

const infoIcon = (
  <svg style={{ cursor: "pointer" }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M13 16H12V12H11M12 8H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
      stroke="#898f9c"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const TICKET_RATES_KEY = "rates_preference_ticket"
export const BLOTTER_RATES_KEY = "rates_preference_blotter"

type Keys = typeof TICKET_RATES_KEY | typeof BLOTTER_RATES_KEY

const initValue = (key: Keys): RateOptions => {
  const stored = localStorage.getItem(key)
  return stored ? (JSON.parse(stored) as RateOptions) : "ROE"
}

const [ratesPreference$, setRatesPreference] = createSignalState<{ [key in Keys]: RateOptions }>({
  [TICKET_RATES_KEY]: initValue(TICKET_RATES_KEY),
  [BLOTTER_RATES_KEY]: initValue(BLOTTER_RATES_KEY),
})

export { ratesPreference$ }

ratesPreference$.subscribe((options) => {
  recordEntries(options).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value))
  })
})

export const RatesDropdown: React.FC<{ storageKey: Keys }> = ({ storageKey }) => {
  const preferences = useStateObservable(ratesPreference$)
  const selected = preferences[storageKey]

  return (
    <div className="flex items-center gap-2">
      <Tooltip
        testId={storageKey}
        message={selected === "APR" ? tooltipMapper("basisAPR") : "(lending interest - borrowing interest * debt ratio) / initial margin"}
      >
        {infoIcon}
      </Tooltip>
      <DropDown
        selectedId={selected}
        displayValue={selected}
        onChange={(id) => setRatesPreference({ ...preferences, [storageKey]: id })}
        className="text-fontColor-500 w-fit"
      >
        {["ROE", "APR"].map((option) => (
          <DropDownOption key={option} valueId={option} className="text-fontColor-500">
            {option}
          </DropDownOption>
        ))}
      </DropDown>
    </div>
  )
}
