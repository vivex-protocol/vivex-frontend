import { FormMessage } from "./messaging/FormMessage"
import { IconType } from "./NotificationIcon"

export const BalanceTooLowErrorMessage: React.FC<{
  hasEnoughBalance: boolean | null
  className?: string
  testId?: string
}> = ({ hasEnoughBalance, className, testId }) => {
  return (
    <FormMessage testId={testId} iconType={IconType.Error} className={className} visible={!hasEnoughBalance}>
      <span>Insufficient wallet balance for this trade</span>
    </FormMessage>
  )
}

export const criticalError = () => (
  <FormMessage iconType={IconType.Error} visible testId="create-ticket--critical-error">
    {`Unexpected error encountered. Unable to open new positions at the moment. Please reach out on our discord if the problem persists`}
  </FormMessage>
)

export const noActiveInstruments = () => (
  <FormMessage iconType={IconType.Error} visible testId="create-ticket--no-active-instruments">
    {`No active instruments to display`}
  </FormMessage>
)
