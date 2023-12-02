import { classNames } from "@/utils/classNames"
import { Side } from "@/utils/custom"
import React from "react"

export const posDivider = <div className="w-full px-3 h-[2px] my-2 bg-backgrounds-300" />

export const dividerNoPad = <div className="w-full h-[2px] my-2 bg-backgrounds-300" />

export const PositionSide: React.FC<{
  side: Side
  testId?: string
}> = ({ side, testId }) => {
  return (
    <div data-testid={testId} className={classNames(side === "Long" ? "text-functional-buy-500" : "text-functional-sell-500")}>
      {side}
    </div>
  )
}

export const NoChange: React.FC<{ testId?: string }> = ({ testId }) => {
  return (
    <div className="text-fontColor-600" data-testid={testId}>
      -
    </div>
  )
}
