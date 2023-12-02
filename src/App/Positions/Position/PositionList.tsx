import { classNames } from "@/utils/classNames"
import React from "react"

export const PositionList: React.FC<{
  tableHeader: React.ReactNode
  children: React.ReactNode
  className?: string
}> = ({ tableHeader, children, className }) => {
  return (
    <div className={classNames("md:max-h-full mx-auto md:mx-0 overflow-x-auto w-full", className)}>
      <div className="inline-block w-full">
        <table className="min-w-full text-sm 2xl:text-base">
          <thead className="font-primary font-normal text-fontColor-500">
            <tr className="py-2 bg-backgrounds-100 sticky top-0 z-[1] shadow-[0_2px_0px_0px_rgb(58,62,85)]">{tableHeader}</tr>
          </thead>
          <tbody className="font-secondary font-normal text-white">{children}</tbody>
        </table>
      </div>
    </div>
  )
}

export const TableHeader: React.FC<{
  children?: React.ReactNode
  className?: string
}> = ({ children, className }) => {
  return (
    <th
      scope="col"
      className={classNames(
        "whitespace-nowrap 2xl:px-4 px-2 py-2 text-sm text-left font-normal bg-inherit border-0 first:pl-2 last:pr-2",
        className,
      )}
    >
      {children}
    </th>
  )
}

export const PositionRow: React.FC<{
  children: React.ReactNode
  testId?: string
  className?: string
}> = ({ children, testId, className }) => {
  return (
    <tr
      className={classNames(
        "bg-backgrounds-100 font-primary text-sm font-normal border-b-2 border-b-backgrounds-400 hover:bg-backgrounds-200 h-10 relative",
        className,
      )}
      data-testid={testId ?? "position"}
    >
      {children}
    </tr>
  )
}

export const PositionCell: React.FC<{
  className?: string
  children: React.ReactNode
  testId?: string
  colSpan?: number
}> = ({ children, className, testId, colSpan }) => {
  return (
    <td
      colSpan={colSpan || 1}
      data-testid={testId}
      className={classNames("2xl:whitespace-nowrap py-2 2xl:px-4 px-2 bg-inherit first:pl-2 last:pr-2", className)}
    >
      {children}
    </td>
  )
}
