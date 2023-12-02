import { classNames } from "@/utils/classNames"

export const PrimaryButton: React.FC<
  React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & { testId?: string }
> = ({ children, disabled, className, testId, ...restProps }) => {
  return (
    <button
      type="button"
      className={classNames(
        "text-fontColor-0 text-base rounded-lg bg-blue-1 focus:outline-none font-primary font-normal h-10 max-w-[360px] min-w-fit px-4",
        disabled ? "opacity-50" : "",
        className,
      )}
      disabled={disabled}
      data-testid={testId}
      {...restProps}
    >
      {children}
    </button>
  )
}
