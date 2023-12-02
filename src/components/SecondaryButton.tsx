import { classNames } from "@/utils/classNames"

export const SecondaryButton: React.FC<
  React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & { testId?: string }
> = ({ disabled, children, className, testId, ...restProps }) => {
  return (
    <button
      className={classNames(
        "text-fontColor-0 text-base rounded-lg border border-backgrounds-300 hover:border-functional-buy-500 focus:outline-none font-primary font-normal h-10 max-w-[360px] min-w-fit px-4",
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
