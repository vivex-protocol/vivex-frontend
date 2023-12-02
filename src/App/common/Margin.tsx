import { assets } from "@/api/graphql/instruments"
import { toDisplayValue2 } from "@/components/CurrencyDisplay"
import { CurrencyIcon } from "@/components/CurrencyIcon"
import { classNames } from "@/utils/classNames"
import { recordKeys } from "@/utils/record-utils"
import { absolute } from "@/vivex-xyz/sdk"
import { Hex } from "viem"
import { useBalance } from "wagmi"
import { TradeQuoteMapped } from "../common"

const MarginTab: React.FC<TradeQuoteMapped & { address?: Hex; selected: boolean; onClick: () => void }> = ({
  cashflow: { tokenAddress, isNative, value },
  cashflowSymbol,
  address,
  chainId,
  selected,
  onClick,
}) => {
  const token = isNative ? undefined : tokenAddress
  const { data: balance } = useBalance({ address, chainId, token, watch: true, staleTime: 5_000 })

  return (
    <div
      key={cashflowSymbol}
      onClick={onClick}
      className={classNames(
        "w-full rounded-lg py-1 text-sm font-normal leading-5",
        "focus:outline-none",
        selected ? "border-functional-buy-500 border-[0.5px]" : "text-fontColor-600 hover:bg-backgrounds-400 hover:text-white",
      )}
    >
      <div className="flex flex-col gap-1 items-center">
        <span className="flex gap-1 text-sm">
          <CurrencyIcon currency={cashflowSymbol} height={12} width={12} />
          {toDisplayValue2(absolute(value), assets[cashflowSymbol]) || "0." + "0".repeat(assets[cashflowSymbol].displayDecimals)}
        </span>
        <span className="text-xs">{`Balance: ${
          balance ? toDisplayValue2(balance.value, assets[cashflowSymbol], { showZero: true }) : "-"
        }`}</span>
      </div>
    </div>
  )
}

interface Quotes {
  base: TradeQuoteMapped
  quote: TradeQuoteMapped
}

type Keys = keyof Quotes

export const Cashflow: React.FC<{
  quotes: Quotes
  address?: Hex
  selectedCashflowCcy: Keys
  setSelectedCashflowCcy: (x: Keys) => void
}> = ({ quotes, address, selectedCashflowCcy, setSelectedCashflowCcy }) => {
  const keys = recordKeys(quotes)

  return (
    <div className="flex space-x-1 rounded-lg bg-backgrounds-200 p-1 border border-1 border-backgrounds-300">
      {keys.map((key) => (
        <MarginTab
          onClick={() => setSelectedCashflowCcy(key)}
          selected={selectedCashflowCcy === key}
          key={key}
          {...quotes[key]}
          address={address}
        />
      ))}
    </div>
  )
}
