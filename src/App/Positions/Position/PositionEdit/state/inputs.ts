import { mapDistinct } from "@/utils/observable-utils"
import { Side } from "@/utils/custom"
import { state } from "@react-rxjs/core"
import { createKeyedSignal } from "@react-rxjs/utils"
import { map, pipe, startWith, switchMap, take } from "rxjs"
import { CtxPositionId, getPosition$ } from "../../queries"

// ---------------- Slippage ---------------- //

const [slippageChanged$, onSlippageChanged] = createKeyedSignal(
  ({ positionId }) => positionId,
  (positionId: string, e: React.ChangeEvent<HTMLInputElement>) => ({
    positionId,
    value: Number(e.target.value),
  }),
)

const slippage$ = state(
  pipe(
    slippageChanged$,
    mapDistinct((e) => e.value),
  ),
  0.5,
)

export { onSlippageChanged, slippage$ }

// ---------------- Leverage ---------------- //

export const [leverageInputChanged$, onLeverageInputChanged] = createKeyedSignal(
  ({ positionId }) => positionId,
  (positionId: string, value: number | null) => ({
    positionId,
    value,
  }),
)

export const leverageInput$ = state((id: string) => leverageInputChanged$(id).pipe(mapDistinct(({ value }) => value)))

// ---------------- Quantity ---------------- //

export const [quantityChanged$, onQuantityChanged] = createKeyedSignal(
  ({ positionId }) => positionId,
  (positionId: string, value: bigint | null) => ({
    positionId,
    value,
  }),
)

// ---------------- Side ---------------- //

const [_selectedSide$, onSideChanged] = createKeyedSignal(
  ({ positionId }) => positionId,
  (positionId: CtxPositionId, value: Side) => ({
    positionId,
    value,
  }),
)

export { onSideChanged }

export const selectedSide$ = state((id: CtxPositionId) =>
  getPosition$(id).pipe(
    take(1),
    switchMap(({ instrument }) =>
      _selectedSide$(id).pipe(
        map(({ value }) => value),
        startWith(instrument.side),
        map((side) => ({
          side,
          multiplier: side !== instrument.side ? -1n : 1n,
        })),
      ),
    ),
  ),
)

// -------- CASHFLOW CCY -------- //

const [_selectedCashflowCcy$, onSelectedCashflowCcy] = createKeyedSignal(
  ({ positionId }) => positionId,
  (positionId: CtxPositionId, value: "base" | "quote") => ({
    positionId,
    value,
  }),
)

export const selectedCashflowCcy$ = state(
  pipe(
    _selectedCashflowCcy$,
    mapDistinct((e) => e.value),
  ),
  "quote",
)

export { onSelectedCashflowCcy }
