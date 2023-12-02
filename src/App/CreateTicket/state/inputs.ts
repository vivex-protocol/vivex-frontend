import { createSignalState } from "@/utils/observable-utils"
import { ObservableType } from "@/utils/types"
import { absolute } from "@/vivex-xyz/sdk"
import { DefaultedStateObservable, state } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { resetable } from "./reset"
import { Side } from "@/utils/custom"
// ------- QUANTITY ------- //

const [quantityChanged$, onQuantityChanged] = createSignal((value: bigint | null) => {
  if (value === null) return null
  return absolute(value)
})

const quantity$ = state(resetable(quantityChanged$, null), null)

// ------- LEVERAGE ------- //

const [leverageInputChanged$, onLeverageInputChanged] = createSignal<number>()

const leverageInput$: DefaultedStateObservable<ObservableType<typeof leverageInputChanged$>> = state(resetable(leverageInputChanged$, 2), 2)

// ------- SLIPPAGE ------- //

const [slippageChanged$, onSlippageChanged] = createSignal((e: React.ChangeEvent<HTMLInputElement>) => Math.abs(Number(e.target.value)))

const slippage$ = state(resetable(slippageChanged$, 0.5), 0.5)

// ------ SIDE ------- //
// @ts-ignore
export const [selectedSide$, onSideChanged] = createSignalState<Side>(Side.Long)

export { leverageInput$, onLeverageInputChanged, onQuantityChanged, onSlippageChanged, quantity$, slippage$ }
