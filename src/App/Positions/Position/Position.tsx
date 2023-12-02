import { GraphPosition } from "@/api/graphql/queries"
import { Subscribe } from "@react-rxjs/core"
import { memo } from "react"
import { ActivePositionRow } from "./ActivePosition"
import { PositionContextProvider } from "./Position.context"
import { PositionDialogContainer, PositionEdit$ } from "./PositionEdit/PositionEdit"

interface ActivePositionProps {
  position: GraphPosition
}

export const ActivePosition: React.FC<ActivePositionProps> = memo(({ position }) => {
  return (
    <PositionContextProvider value={position}>
      <ActivePositionRow data-position-id={position.id} position={position}>
        <Subscribe source$={PositionEdit$(position.id)}>
          <PositionDialogContainer />
        </Subscribe>
      </ActivePositionRow>
    </PositionContextProvider>
  )
})
