import { Tooltip } from "@/components/Tooltip"
import { TooltipKey, tooltipMapper } from "@/components/tooltipContent"
import { classNames } from "@/utils/classNames"
import { withPrefix } from "@/utils/test-utils"
import { ReactNode } from "react"

export const SummaryTable: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div className={classNames("flex flex-col rounded-lg font-normal font-primary w-full px-4 py-2 bg-backgrounds-200", className)}>
    {children}
  </div>
)

export const SummaryRow: React.FC<{
  title: string
  children: React.ReactNode
  tooltipKey?: TooltipKey
  className?: string
  testId?: string
  loading?: boolean
}> = ({ children, title, className, tooltipKey, loading, testId }) => (
  <div className={classNames("flex items-center justify-between w-full text-sm h-6 border-primary-03 font-primary", className)}>
    <span className="block text-fontColor-500">{withTooltip(title, tooltipKey)}</span>
    <div data-testid={testId} className={classNames("flex justify-end", loading ? "blur-sm" : "")}>
      {children}
    </div>
  </div>
)

const withTooltip = (node: ReactNode, tooltipKey?: TooltipKey) => {
  return tooltipKey ? (
    <Tooltip testId={`${tooltipKey}`} message={tooltipMapper(tooltipKey)}>
      {node}
    </Tooltip>
  ) : (
    node
  )
}

export const Arrow: React.FC<{ size?: string | number } & JSX.IntrinsicElements["svg"]> = ({ size = 28, ...svgProps }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" {...svgProps}>
    <rect width="28" height="28" rx="14" fill="#6271EB" />
    <g clipPath="url(#clip0_706_13472)">
      <path d="M18.01 13H6V15H18.01V18L22 14L18.01 10V13Z" fill="white" />
    </g>
    <defs>
      <clipPath id="clip0_706_13472">
        <rect width="24" height="24" fill="white" transform="translate(2 2)" />
      </clipPath>
    </defs>
  </svg>
)

export const ResultingPositionRow: React.FC<{
  title: string
  from: React.ReactNode
  to: React.ReactNode
  tooltipKey?: TooltipKey
  resultingTestId: string
  loading?: boolean
}> = ({ title, from, to, tooltipKey, resultingTestId, loading }) => (
  <div className="flex flex-col justify-between text-fontColor-0 relative my-1 gap-[0.2rem]">
    <div className="text-fontColor-500 text-[0.7rem]">{withTooltip(title, tooltipKey)}</div>
    <div className="flex justify-between text-sm">
      <div data-testid={withPrefix(resultingTestId, "edit-resulting-position-from")} className="w-[42.5%] flex self-start">
        {from}
      </div>
      {to !== null ? (
        <>
          <Arrow className="-translate-y-1/2 -translate-x-1/2 absolute inset-1/2" />
          <div
            className={classNames("w-[42.5%] flex justify-end", loading ? "blur-sm" : "")}
            data-testid={withPrefix(resultingTestId, "edit-resulting-position-to")}
          >
            {to}
          </div>
        </>
      ) : null}
    </div>
  </div>
)
