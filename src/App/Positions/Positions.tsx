import { Loading } from "@/components/Loading"
import { classNames } from "@/utils/classNames"
import { createSignalState } from "@/utils/observable-utils"
import { Subscribe, useStateObservable } from "@react-rxjs/core"
import { Suspense } from "react"
import { merge, of, switchMap } from "rxjs"
import { Hex } from "viem"
import { useAccount } from "wagmi"
import { TransactionHistoryFilter } from "../TradeHistory/components/TransactionHistoryFilter"
import { TransactionHistoryHeaders, TransactionHistoryTable } from "../TradeHistory/components/blotter/TradeHistory"
import { TransactionHistory$ } from "../TradeHistory/state"
import { ActivePositionHeaders } from "./Position/ActivePosition"
import { ActivePosition } from "./Position/Position"
import { PositionAccountCtx, usePositionAccount } from "./Position/Position.context"
import { PositionList } from "./Position/PositionList"
import { graphPositions$ } from "./Position/queries"

const [selectedTab$, selectTab] = createSignalState<"Positions" | "History">("Positions")

export { selectTab }

const PositionsInner: React.FC = () => {
  const selected = useStateObservable(selectedTab$)
  const account = usePositionAccount()
  const positionsMap = useStateObservable(graphPositions$(account))

  const positions = Object.values(positionsMap).sort((a, b) => b.creationBlockTimestamp - a.creationBlockTimestamp)

  const openPositions =
    selected === "Positions" ? (
      <div className="h-full">
        <PositionList tableHeader={<ActivePositionHeaders />}>
          {positions.length ? (
            positions.map((position) => {
              return (
                <Suspense key={position.id} fallback={loadingPosition}>
                  <ActivePosition position={position} />
                </Suspense>
              )
            })
          ) : (
            <NoPositionsMessage />
          )}
        </PositionList>
      </div>
    ) : null

  const history =
    selected === "History" ? (
      <div className="h-full">
        <div className="absolute right-2 top-2 text-base text-white z-[2] mt-2 flex flex-end">
          <TransactionHistoryFilter />
        </div>
        <PositionList tableHeader={<TransactionHistoryHeaders />}>
          <Suspense fallback={loadingPosition}>
            <TransactionHistoryTable />
          </Suspense>
        </PositionList>
      </div>
    ) : null

  return (
    <div className="flex flex-col h-full min-w-full bg-backgrounds-100 rounded-lg relative">
      <div className="flex gap-4 h-[40px] m-2">
        <SelectTab
          selected={selected === "Positions"}
          label={"Open positions"}
          count={positions.length}
          testId="blotter-tab--open-positions"
          onClick={() => selectTab("Positions")}
        />
        <SelectTab
          selected={selected === "History"}
          label={"Transaction history"}
          testId="blotter-tab--transaction-history"
          onClick={() => selectTab("History")}
        />
      </div>
      <div className="h-[calc(100%-40px)] overflow-clip bg-clip-border rounded-b-lg">
        {openPositions}
        {history}
      </div>
    </div>
  )
}

export const Positions$ = (account: Hex | undefined) =>
  account ? merge(selectedTab$.pipe(switchMap((selected) => (selected === "Positions" ? [] : TransactionHistory$(account))))) : of(null)

export const Positions: React.FC = () => {
  const { address } = useAccount()
  return (
    <div data-testid="positions" className={classNames("flex mx-auto h-full w-full text-fontColor-0")}>
      <PositionAccountCtx value={address ? (address.toLowerCase() as Hex) : address!}>
        <Subscribe
          source$={Positions$(address)}
          fallback={
            <div
              className="mt-20"
              style={{
                width: "140px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              <Loading size={40} />
            </div>
          }
        >
          <PositionsInner />
        </Subscribe>
      </PositionAccountCtx>
    </div>
  )
}

const NoPositionsMessage: React.FC = () => {
  return (
    <tr>
      <td data-testid="no-open-positions" className="whitespace-nowrap pl-4 pt-1 font-primary text-left">
        No open positions
      </td>
    </tr>
  )
}

const loadingPosition = (
  <tr data-testid="loading-position" className="relative rounded-lg isolate overflow-hidden">
    <td className="rounded-b-lg font-secondary font-normal">
      <div className="flex flex-row h-10 items-center justify-center">
        <Loading size={20} />
      </div>
    </td>
  </tr>
)

const SelectTab: React.FC<{
  selected: boolean
  label: string
  testId: string
  count?: number
  onClick: () => void
}> = ({ selected, label, count, onClick, testId }) => {
  return (
    <div
      className={classNames(
        selected ? "text-fontColor-0 border-b-2 border-functional-buy-500" : "text-fontColor-400 hover:text-functional-buy-500",
        "py-2 mb-2 px-1 text-sm cursor-pointer",
      )}
      data-testid={testId}
      onClick={onClick}
    >
      <span>{`${label} ${count ? `(${count})` : ""}`}</span>
    </div>
  )
}
