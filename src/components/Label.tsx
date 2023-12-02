import { classNames } from "@/utils/classNames"

export const Label: React.FC<{
  label: string
  className?: string
  testId?: string
}> = ({ className, label, testId }) => {
  return (
    <span
      className={classNames(
        "py-1 px-3 rounded-full font-primary text-sm font-normal bg-backgrounds-300 text-fontColor-0 inline-block",
        className,
      )}
      data-testid={testId}
    >
      {label}
    </span>
  )
}
