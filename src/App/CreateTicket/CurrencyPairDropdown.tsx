import { Pair } from "@/api/graphql/instruments"
import { CurrencyIcon } from "@/components/CurrencyIcon"
import { classNames } from "@/utils/classNames"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, DocumentIcon, PlusIcon, XCircleIcon } from "@heroicons/react/24/solid"
import { useStateObservable } from "@react-rxjs/core"
import { useEffect, useRef, useState } from "react"
import { merge } from "rxjs"
import { filteredPairs$, onPairSelected, onResetForm, onUserSearch, selectedPair$, userSearch$ } from "./state"

export const CurrencyPairDropdown$ = merge(filteredPairs$, userSearch$, selectedPair$)
export const CurrencyPairDropdown = () => {
  const selectedPair = useStateObservable(selectedPair$)
  const ref = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState<boolean>(false)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
        onUserSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [setIsOpen])

  return (
    <div className="relative" ref={ref}>
      <button
        data-testid="currency-pair-select--button"
        onClick={(e) => {
          e.preventDefault()
          setIsOpen((isOpen) => !isOpen)
        }}
        className={classNames(
          "w-full flex flex-row justify-between items-center p-2 border border-1  focus:border-accents-500 rounded-lg",
          isOpen ? "border-accents-500" : "border-backgrounds-300",
        )}
      >
        <CurrencyPairDisplay pair={selectedPair} />
        {isOpen ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
      </button>
      <CurrencyPairDropdownContent isOpen={isOpen} setIsOpen={setIsOpen} selectedPair={selectedPair} />
    </div>
  )
}

const CurrencyPairDropdownContent: React.FC<{
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  selectedPair: Pair
}> = ({ isOpen, setIsOpen, selectedPair }) => {
  const pairs = useStateObservable(filteredPairs$)
  return (
    <div
      data-testid="currency-pair-select--panel"
      className={classNames("text-base bg-backgrounds-200 text-white absolute w-full rounded-xl p-2 z-10 ", isOpen ? "" : "hidden")}
    >
      <CurrencyPairSearch />
      <div className="flex max-h-[340px] flex-col overflow-scroll justify-start mt-3 mb-1">
        {pairs.map((pair) => (
          <div
            data-testid={"currency-pair"}
            data-ccy-pair={`currency-pair--${pair.base.symbol.toLowerCase()}-${pair.quote.symbol.toLowerCase()}`}
            key={pair.symbol}
            className="flex flex-row justify-between items-center hover:bg-backgrounds-300 rounded-lg p-2"
            onClick={() => {
              onResetForm()
              onPairSelected(pair)
              setTimeout(() => {
                setIsOpen(false)
                onUserSearch("")
              }, 300)
            }}
          >
            <CurrencyPairDisplay pair={pair} />
            {selectedPair === pair && <CheckIcon className="h-5 w-5 text-accents-500" />}
          </div>
        ))}
        {pairs.length === 0 && (
          <div className="flex flex-col gap-2 items-center text-sm text-fontColor-500">
            <DocumentIcon className="h-10 w-10" />0 results found. Clear search and try again.
          </div>
        )}
      </div>
    </div>
  )
}

const CurrencyPairSearch: React.FC = () => {
  const userSearch = useStateObservable(userSearch$)

  const handleInput = (input: string) => {
    const regex = /^[a-zA-Z\.]*\/?[a-zA-Z\.]*$/
    const isValid = regex.test(input)
    if (isValid) onUserSearch(input)
  }

  return (
    <div>
      <div className="cursor-pointer flex flex-row gap-2 justify-start items-center bg-backgrounds-100 text-white w-full rounded-lg p-2 my-1 border border-backgrounds-400 hover:border-accents-500 focus-within:border-accents-500 mb-2">
        <PlusIcon className="h-5 w-5" />
        <input
          data-testid="currency-pair-search--input"
          type="text"
          value={userSearch}
          ref={(el) => el?.focus()}
          onChange={(e) => handleInput(e.target.value)}
          placeholder={"Search for tokens, instrument..."}
          className="box-border bg-backgrounds-100 w-full focus:outline-none"
        />
        {userSearch && (
          <button
            data-testid="currency-pair-search--clear-input"
            onClick={(e) => {
              e.preventDefault()
              onUserSearch("")
            }}
          >
            <XCircleIcon className="h-5 w-5" />
          </button>
        )}
      </div>
      <span className="text-sm text-fontColor-500 mt-3">{userSearch && `Instruments matching "${userSearch}"`}</span>
    </div>
  )
}

const CurrencyPairDisplay: React.FC<{ pair: Pair }> = ({ pair: { base, quote, symbol } }) => (
  <span id={`${base}-${quote}`} className="flex items-center">
    <span className="rounded-full overflow-hidden">
      <CurrencyIcon width={20} height={20} currency={base.symbol} />
    </span>
    <span className="rounded-full overflow-hidden -ml-[8px] mr-2">
      <CurrencyIcon width={20} height={20} currency={quote.symbol} />
    </span>
    {symbol}
  </span>
)
