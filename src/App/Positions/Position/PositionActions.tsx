import { ActionButton, ActionsPanel } from "@/components/PositionMenu"
import React, { useState } from "react"
import { useAccount, useSwitchNetwork } from "wagmi"
import { usePositionContext } from "./Position.context"
import { EditType, onEditOrCancel } from "./PositionEdit/state/base"
import { unwrapId } from "./queries"

export const PositionActions: React.FC = () => {
  const { id } = usePositionContext()
  let [isOpen, setIsOpen] = useState(false)
  const account = useAccount()
  const walletName = account.connector?.name || ""
  const { switchNetwork } = useSwitchNetwork()

  const switchCb = () => {
    if (walletName.toLowerCase().includes("rabby")) {
      switchNetwork?.(unwrapId(id).chainId)
    }
  }

  return (
    <ActionsPanel isOpen={isOpen} setIsOpen={setIsOpen} testIdPrefix="position">
      <ActionButton
        data-testid="position--close-button"
        onClick={() => {
          switchCb()
          setIsOpen(false)
          //timeout is important here to prevent multiple dialogs interference resulting in the body scroll to become blocked
          setTimeout(() => {
            onEditOrCancel(id, EditType.close)
          }, 100)
        }}
      >
        Close
      </ActionButton>
      <ActionButton
        data-testid="position--edit-button"
        onClick={() => {
          switchCb()
          setIsOpen(false)
          //timeout is important here to prevent multiple dialogs interference resulting in the body scroll to become blocked
          setTimeout(() => {
            onEditOrCancel(id, EditType.edit)
          }, 100)
        }}
      >
        Modify
      </ActionButton>
      <ActionButton
        data-testid="position--edit-button"
        onClick={() => {
          switchCb()
          setIsOpen(false)
          //timeout is important here to prevent multiple dialogs interference resulting in the body scroll to become blocked
          setTimeout(() => {
            onEditOrCancel(id, EditType.linkedOrders)
          }, 100)
        }}
      >
        TP / SL
      </ActionButton>
    </ActionsPanel>
  )
}
