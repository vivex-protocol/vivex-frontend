import { Asset } from "../../../../../api/graphql/queries"
import { toDisplayValue, toDisplayValue2 } from "../../../../../components/CurrencyDisplay"
import { CurrencyIcon } from "../../../../../components/CurrencyIcon"
import { Tooltip } from "../../../../../components/Tooltip"
import { absolute } from "@/vivex-xyz/sdk"
import { Hex } from "viem"
import { useAccount, useBalance } from "wagmi"

const infoIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M13 16H12V12H11M12 8H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
      stroke="#898f9c"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const infoTooltip = (fee: string, margin: string) => (
  <div className="flex flex-col gap-1">
    {fee ? (
      <div className="flex justify-between gap-3">
        <span>Trading Fee:</span>
        <span>{fee}</span>
      </div>
    ) : null}
    <div className="flex justify-between gap-3">
      <span>Margin:</span>
      <span>{margin}</span>
    </div>
  </div>
)

export const Payment: React.FC<{
  amount: bigint
  fee: bigint
  asset: Pick<Asset, "decimals" | "displayDecimals" | "symbol">
  token?: Hex
  chainId: number
  testId: string
}> = ({ amount, asset, fee, token, chainId, testId }) => {
  const { address } = useAccount()
  const { data: balance } = useBalance({ address, chainId, token, watch: true })
  return (
    <div className="flex flex-col">
      <div className="flex justify-between py-2 px-4">
        <span className="flex gap-1 items-center">
          <span>{amount > 0n ? "You Deposit " : "You Receive "}</span>
          <Tooltip
            testId={`${testId}-payment`}
            message={infoTooltip(toDisplayValue(fee, asset), toDisplayValue(amount - fee, asset, { formatAsDelta: true }))}
            className="cursor-pointer items-center"
          >
            {infoIcon}
          </Tooltip>
        </span>
        <span className="flex gap-1">
          <CurrencyIcon currency={asset.symbol} />
          {toDisplayValue2(absolute(amount), asset)}
        </span>
      </div>
      {balance ? (
        <div className="px-4 flex justify-between text-sm">
          <span>Your Balance: </span>
          <span>{toDisplayValue2(balance?.value, asset) || "0." + "0".repeat(asset.displayDecimals)}</span>
        </div>
      ) : null}
    </div>
  )
}
