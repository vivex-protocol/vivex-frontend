// import { onUncaughtError } from "@/utils/error-utils"
import { state } from "@react-rxjs/core"
import { createKeyedSignal } from "@react-rxjs/utils"
import { map, merge, share } from "rxjs"
import { leverageInputChanged$, quantityChanged$ } from "./inputs"

export type FormErrorOrigin =
  // | "marketImpact" // TODO: Add market impact error
  "deltaCost" | "leverageBoundariesForQuantity" | "benchmarkMinQtyCost"

const toErrorKey = (positionId: string, origin: FormErrorOrigin) => `positionId: ${positionId} origin: ${origin}`

const [errors$, setFormError] = createKeyedSignal(
  ({ positionId, origin }) => toErrorKey(positionId, origin),
  (positionId: string, origin: FormErrorOrigin, error: any) => ({
    positionId,
    origin,
    error,
  }),
)

export const formErrors$ = state((positionId: string, origin: FormErrorOrigin) => errors$(toErrorKey(positionId, origin)))

export const onEditFormError = (positionId: string, origin: FormErrorOrigin) =>
  // onUncaughtError((error) => {
  //   if (error) console.error("Uncaught error for editing positionId: ", positionId, origin, error)
  //   setFormError(positionId, origin, error)
  // })
  console.log ("onEditFormError", positionId, origin)

export const formChangeEvents$ = (id: string) => merge(quantityChanged$(id), leverageInputChanged$(id)).pipe(share())

export const hasCriticalError$ = state(
  (id: string) => formErrors$(id, "benchmarkMinQtyCost").pipe(map((error) => error.error !== null)),
  false,
)
