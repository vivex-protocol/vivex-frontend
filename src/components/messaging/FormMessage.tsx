import { classNames } from "@/utils/classNames"
import { PropsWithChildren } from "react"
import { IconType, NotificationIcon } from "../NotificationIcon"

export const FormMessage: React.FC<
  PropsWithChildren<{
    className?: string
    iconType?: IconType
    testId?: string
    visible?: boolean
  }>
> = ({ children, className, visible, iconType, testId }) => {
  const baseClass = "font-primary text-sm flex gap-3 items-center py-2 px-4 rounded-lg bg-backgrounds-100 border-functional-buy-400 border"

  return (
    <div className={classNames(visible ? "" : "hidden", className, baseClass)} data-testid={testId}>
      {iconType ? <NotificationIcon iconType={iconType} /> : null}
      {children}
    </div>
  )
}
