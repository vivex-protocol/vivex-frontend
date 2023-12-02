import { mapDistinct } from "@/utils/observable-utils"
import { state } from "@react-rxjs/core"
import { createKeyedSignal } from "@react-rxjs/utils"
import { pipe } from "rxjs"

export const EditType = {
  none: "n",
  edit: "e",
  close: "c",
  linkedOrders: "lo",
}
export type EditType = (typeof EditType)[keyof typeof EditType]

const [editOrCancel$, onEditOrCancel] = createKeyedSignal(
  ({ positionId }) => positionId,
  (positionId: string, value: EditType) => ({
    positionId,
    value,
  }),
)

export { onEditOrCancel }
export const positionEditFlow$ = state(
  pipe(
    editOrCancel$,
    mapDistinct((x) => x.value),
  ),
  EditType.none,
)
