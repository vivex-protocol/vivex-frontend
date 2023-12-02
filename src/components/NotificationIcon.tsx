import { classNames } from "@/utils/classNames"
import * as env from "../env"

export enum IconType {
  Warning = "warning",
  Warning2 = "warning2",
  Error = "error",
}

export const NotificationIcon: React.FC<{
  iconType: IconType
  className?: string
}> = ({ iconType, className }) => {
  return <img className={classNames(className)} alt={iconType} src={env.BASE_URL + `notificationIcons/${iconType}.svg`} />
}
