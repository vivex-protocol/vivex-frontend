import { classNames } from "@/utils/classNames"
import { getTimeRemaining } from "@/utils/getTimeRemaining"

export const Countdown: React.FC<{
  startTimestamp: number
  endTimestamp: number
  colourise?: boolean
}> = ({ startTimestamp, endTimestamp, colourise }) => {
  const startDate = new Date(startTimestamp * 1000)
  const endDate = new Date(endTimestamp * 1000)

  if (endTimestamp < startTimestamp) return <span>-</span>

  const { days, hours, minutes } = getTimeRemaining(startDate, endDate)

  if (days > 0) {
    const rhs = days < 5 ? ` ${hours}h` : ""
    return <span className={classNames(colourise && "text-fontColor-0")}>{`${days}d ${rhs} ago`}</span>
  } else if (hours > 0) {
    const rhs = hours < 5 ? `${minutes}m` : ""
    return <span className={classNames(colourise && "text-functional-warning-300")}>{`${hours}h ${rhs} ago`}</span>
  } else if (minutes > 0) {
    return <span className={classNames(colourise && "text-functional-error-400")}>{minutes + "m ago"}</span>
  } else {
    return <span className={classNames(colourise && "text-functional-error-400")}>{"just now"}</span>
  }
}
