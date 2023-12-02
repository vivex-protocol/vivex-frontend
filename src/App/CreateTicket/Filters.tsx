import { SupportedChainIds, chains } from "@/api/chain"
import { activeMoneyMarkets } from "@/api/graphql/instruments"
import { Checkbox } from "@/components/Checkbox"
import { createSignalState } from "@/utils/observable-utils"
import { getDisplayMoneyMarketName } from "@/vivex-xyz/sdk"
import { Popover } from "@headlessui/react"
import { FilmIcon } from "@heroicons/react/24/solid"
import { useStateObservable } from "@react-rxjs/core"
import { MoneyMarket } from "@/utils/custom"

const MM_KEY = "exclude_mm"
const CHAIN_KEY = "exclude_chain"

const loadFilters = () => {
  const storedMms = localStorage.getItem(MM_KEY)
  // @ts-ignore
  const excludedMoneyMarkets = new Set(storedMms ? (JSON.parse(storedMms) as MoneyMarket[]) : [])

  const storedChains = localStorage.getItem(CHAIN_KEY)
  const excludedChains = new Set(storedChains ? (JSON.parse(storedChains) as SupportedChainIds[]) : [])

  return { excludedChains, excludedMoneyMarkets }
}
// @ts-ignore
function storeFilter(key: typeof MM_KEY, set: Set<MoneyMarket>): void
function storeFilter(key: typeof CHAIN_KEY, set: Set<SupportedChainIds>): void
function storeFilter(key: any, set: Set<any>): any {
  localStorage.setItem(key, JSON.stringify(Array.from(set)))
}

const { excludedChains, excludedMoneyMarkets } = loadFilters()

const [excludedMm$, onExcludeMoneyMarket] = createSignalState(excludedMoneyMarkets)
const [excludedChains$, onExcludeChain] = createSignalState(excludedChains)

excludedMm$.subscribe((set) => {
  storeFilter(MM_KEY, set)
})
excludedChains$.subscribe((set) => {
  storeFilter(CHAIN_KEY, set)
})

export { excludedChains$, excludedMm$ }

export const ChainAndMoneyMarketsFilter: React.FC<{ forceOpen?: boolean }> = ({ forceOpen }) => {
  const excludedMoneyMarkets = useStateObservable(excludedMm$)
  const excludedChains = useStateObservable(excludedChains$)

  const filterCount = excludedMoneyMarkets.size + excludedChains.size

  return (
    <Popover className="relative">
      <Popover.Button className="flex outline-0 h-4 items-center">
        <FilmIcon className="w-4 h-4 inline text-functional-buy-500" />
        {filterCount > 0 && (
          <div className="text-sm bg-blue-1 rounded-md w-4 h-4 content-center ml-1">
            <span className="text-fontColor-100 text-xs">{filterCount}</span>
          </div>
        )}
      </Popover.Button>
      <Popover.Panel className="absolute z-50" static={forceOpen ?? false}>
        <div
          className="flex flex-col whitespace-nowrap z-10 min-w-fit gap-1 rounded-lg bg-backgrounds-0 border border-backgrounds-300 text-left px-4 py-2 drop-shadow-dropdown"
          onClick={(e) => e.preventDefault()}
        >
          <span className="text-sm float-left text-fontColor-200 py-2">Chains</span>
          {chains.map(({ id, name }) => (
            <div key={id} className="flex items-center gap-2">
              <Checkbox
                checked={!excludedChains.has(id)}
                onChange={(bool) => {
                  const newSet = new Set(excludedChains)
                  if (bool) newSet.delete(id)
                  else newSet.add(id)
                  onExcludeChain(newSet)
                }}
              />
              <span className="pr-4">{name}</span>
            </div>
          ))}
          <span className="text-sm float-left text-fontColor-200 py-2">Markets</span>
          {Object.values(MoneyMarket)
          // @ts-ignore
            .filter((x): x is MoneyMarket => activeMoneyMarkets.has(x as any))
            .map((mm) => (
              <div key={mm} className="flex items-center gap-2">
                <Checkbox
                  checked={!excludedMoneyMarkets.has(mm)}
                  onChange={(bool) => {
                    const newSet = new Set(excludedMoneyMarkets)
                    if (bool) newSet.delete(mm)
                    else newSet.add(mm)
                    onExcludeMoneyMarket(newSet)
                  }}
                />
                <span className="pr-4">{getDisplayMoneyMarketName(mm)}</span>
              </div>
            ))}
        </div>
      </Popover.Panel>
    </Popover>
  )
}
