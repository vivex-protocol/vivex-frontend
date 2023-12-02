import { classNames } from "@/utils/classNames"
import React, { PropsWithChildren } from "react"
import { Tooltip as ReactTooltip } from "react-tooltip"

export const Tooltip: React.FC<
  PropsWithChildren<{
    message: React.ReactNode | string
    className?: string
    testId: string
  }>
> = ({ message, children, className, testId }) => {
  return (
    <>
      <span
        className={classNames(className)}
        data-testid={testId}
        data-tooltip-id={testId}
        data-tooltip-delay-hide={300}
        data-tooltip-delay-show={300}
      >
        {children}
      </span>
      <ReactTooltip
        style={{ whiteSpace: "pre-wrap", zIndex: 1000, backgroundColor: "white", color: "black", maxWidth: 350 }}
        opacity={100}
        positionStrategy="fixed"
        id={testId}
        place="top"
      >
        {message}
      </ReactTooltip>
    </>
  )
}
