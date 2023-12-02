import { NumberInput } from "@/components/NumberInput"
import { classNames } from "@/utils/classNames"
import { withPrefix } from "@/utils/test-utils"
import { Popover } from "@headlessui/react"
import { FilmIcon } from "@heroicons/react/24/solid"
import { useStateObservable } from "@react-rxjs/core"
import { useState } from "react"
import { filterCount$, filters$, setFilters } from "../state"

const buttonClasses =
  "px-4 py-2 text-sm inline bg-backgrounds-300 hover:bg-backgrounds-400 hover:bg-backgrounds-400 rounded-xl border-backgrounds-300 hover:border-backgrounds-400 disabled:bg-backgrounds-0 border-[1.5px] disabled:border-backgrounds-300"

export const TransactionHistoryFilterForm: React.FC = () => {
  const filterState = useStateObservable(filters$)
  const filterCount = useStateObservable(filterCount$)
  const [positionId, setPositionId] = useState(filterState.positionId)

  return (
    <div
      data-testid={withPrefix("menu", "transaction-history-filter")}
      className="w-[256px] z-10 min-w-fit rounded-lg bg-backgrounds-0 border border-backgrounds-300 text-left px-4 py-2 drop-shadow-dropdown"
      onClick={(e) => e.preventDefault()}
    >
      <span className="text-sm float-left text-fontColor-500">Filter by Position</span>
      <NumberInput
        testIdPrefix={withPrefix("id", "transaction-history-filter")}
        htmlFor="positionId"
        className="text-base mt-3"
        value={positionId ?? ""}
        onKeyDown={({ key }) => {
          if (key === "Enter") {
            setFilters({ positionId })
          }
        }}
        onChange={(e) => setPositionId(e.target.value)}
        prefix={<span>#</span>}
      />
      <Popover.Group className="flex row gap-3 mt-4">
        <Popover.Button
          data-testid={withPrefix("clear-btn", "transaction-history-filter")}
          className={classNames(buttonClasses)}
          onClick={() => {
            const positionId = ""
            setPositionId(positionId)
            setFilters({ positionId })
          }}
          disabled={filterCount === 0}
        >
          Clear
        </Popover.Button>
        <Popover.Button
          data-testid={withPrefix("apply-btn", "transaction-history-filter")}
          className={classNames(buttonClasses, "flex-grow")}
          onClick={() => setFilters({ positionId })}
          disabled={filterState.positionId === positionId}
        >
          Apply changes
        </Popover.Button>
      </Popover.Group>
    </div>
  )
}

export const TransactionHistoryFilter: React.FC<{ forceOpen?: boolean }> = ({ forceOpen }) => {
  const filterCount = useStateObservable(filterCount$)

  return (
    <Popover className="relative">
      <Popover.Button className="flex outline-0 h-5" data-testid={withPrefix("filter-btn", "transaction-history")}>
        <FilmIcon className="w-4 h-4 inline mt-0.5 text-functional-buy-500 my-auto" />
        <span className="leading-5 text-sm mx-1">Filters</span>
        {filterCount > 0 && (
          <div className="text-sm bg-blue-1 rounded-md w-5 h-5 content-center ml-1">
            <span className="leading-5">{filterCount}</span>
          </div>
        )}
      </Popover.Button>
      <Popover.Panel className="absolute right-0 z-50" static={forceOpen ?? false}>
        <TransactionHistoryFilterForm />
      </Popover.Panel>
    </Popover>
  )
}
