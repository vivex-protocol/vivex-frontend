import { loading } from "@/components/Loading"
import { classNames } from "@/utils/classNames"
import { Subscribe } from "@react-rxjs/core"
import { Suspense } from "react"
import { ClaimRewards } from "../common/ClaimRewards"
import { DefineInstrument } from "./DefineInstrument"
import { Leverage } from "./Equity"
import { LinkedOrders } from "./LinkedOrders"
import { MoneyMarkets, PriceBreakdown } from "./PriceQuote"
import { Quantity } from "./Quantity"
import { Submit } from "./Submit"
import { Margin } from "./YouPay"

const divider = <div className="w-full border-[1px] border-backgrounds-300 px-4" />

export function CreateTicket() {
  return (
    <div
      className={classNames(
        "xl:flex text-secondary-01 overflow-scroll sm:min-w-[22rem] bg-backgrounds-100 rounded-lg lg:h-full flex-col mx-auto gap-4 w-full max-w-sm",
      )}
    >
      <Subscribe fallback={loading}>
        <div className="flex flex-col gap-3 font-primary p-4">
          <div className="sm:hidden flex justify-end w-full">
            <Subscribe fallback={null}>
              <ClaimRewards />
            </Subscribe>
          </div>
          <DefineInstrument />
          <Quantity />
          <Suspense>
            <Margin />
          </Suspense>
          <Suspense>
            <Leverage />
          </Suspense>
          <MoneyMarkets />
          {divider}
          <Suspense fallback={null}>
            <LinkedOrders />
          </Suspense>
          <Submit />
          <Suspense>
            <PriceBreakdown />
          </Suspense>
        </div>
      </Subscribe>
    </div>
  )
}
