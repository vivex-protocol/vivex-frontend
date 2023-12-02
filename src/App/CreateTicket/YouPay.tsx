import { useStateObservable } from "@react-rxjs/core"
import { useAccount } from "wagmi"
import { Cashflow } from "../common/Margin"
import { nsPriceQuotes$, selectedCashflowCcy$, setSelectedCashflowCcy } from "./state"
import { leverageInput$ } from "./state/inputs"

export const Margin = () => {
  const { address } = useAccount()
  const selectedCashflowCcy = useStateObservable(selectedCashflowCcy$)
  let priceQuotes = useStateObservable(nsPriceQuotes$)
  const leverage = useStateObservable(leverageInput$)
  if (priceQuotes.base.pair.symbol === "DAI/USDT") {
    priceQuotes.base.resultingPosition.margin = parseFloat(priceQuotes.base.resultingPosition.value) / leverage
    priceQuotes.base.cashflow.value = BigInt(Math.floor(parseFloat(priceQuotes.base.resultingPosition.value) / leverage * 1000000)) * priceQuotes.base.cashflow.unit / BigInt(1000000)
    priceQuotes.quote.resultingPosition.margin = parseFloat(priceQuotes.quote.resultingPosition.value) / leverage
    priceQuotes.quote.cashflow.value = BigInt(Math.floor(parseFloat(priceQuotes.quote.resultingPosition.value) / leverage * 1000000)) * priceQuotes.quote.cashflow.unit / BigInt(1000000)
  }

  return (
    <div className="flex flex-col text-base gap-2">
      <span className="px-2 text-fontColor-500 text-sm">Margin</span>
      <Cashflow
        address={address}
        selectedCashflowCcy={selectedCashflowCcy}
        quotes={priceQuotes}
        setSelectedCashflowCcy={setSelectedCashflowCcy}
      />
    </div>
  )
}
