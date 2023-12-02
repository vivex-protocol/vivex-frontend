import { chainsMap } from "@/api/chain"
import { HistoryItem } from "@/api/graphql/positions"
import { ActionButton, ActionsPanel } from "@/components/PositionMenu"
import React, { useState } from "react"
import { DetailsIcon, ExternalLinkIcon } from "../Icons"
import { TransactionDetails } from "../transaction-details/TransactionDetails"

const testIdPrefix = "transaction"

type TransactionMenuProps = {
  item: HistoryItem
}

export const TransactionMenu: React.FC<TransactionMenuProps> = ({ item }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showDialog, setShowDialog] = useState(false)

  const chain = chainsMap.get(item.chainId as any)
  const blockExplorer = chain?.blockExplorers.default

  return (
    <>
      <ActionsPanel isOpen={isMenuOpen} setIsOpen={setIsMenuOpen} testIdPrefix={testIdPrefix}>
        <ActionButton
          onClick={() => {
            setIsMenuOpen(false)
            setTimeout(() => {
              setShowDialog(true)
            }, 100)
          }}
          className="flex flex-row gap-2"
          testId={`${testIdPrefix}--view-button`}
        >
          <DetailsIcon />
          Transaction Details
        </ActionButton>

        {blockExplorer ? (
          <ActionButton
            onClick={() => {
              setIsMenuOpen(false)
              window.open(`${blockExplorer.url}/tx/${item.transactionHash}`, "_blank")
            }}
            className="flex flex-row gap-2 items-center"
          >
            <ExternalLinkIcon /> {blockExplorer.name}
          </ActionButton>
        ) : null}
      </ActionsPanel>
      <TransactionDetails item={item} isOpen={showDialog} setIsOpen={setShowDialog} />
    </>
  )
}
