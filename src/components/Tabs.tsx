import { PropsWithChildren, ReactNode } from "react"

const baseStyle = `flex w-1/2 font-primary justify-center items-center select-none`

export const Tabs: React.FC<{ children: ReactNode[] }> = ({ children }) => <div className="flex gap-3 pb-3">{children}</div>

export const TabButton: React.FC<
  PropsWithChildren<{
    isActive?: boolean
    onClick: () => void
    className?: string
    isDisabled?: boolean
    testId?: string
  }>
> = ({ isActive, onClick, children, className, isDisabled, testId }) => {
  return (
    <button
      className={`${baseStyle} h-8 text-sm pb-0 w-auto hover: ${className} ${
        isActive
          ? "border-b-2 border-accents-500 text-fontColor-0"
          : "border-b-2 border-transparent text-fontColor-400 hover:text-accents-500"
      }`}
      disabled={isDisabled}
      onClick={
        isDisabled
          ? undefined
          : (e) => {
              e.preventDefault()
              onClick()
            }
      }
      data-testid={testId}
      data-isactive={isActive}
    >
      {children}
    </button>
  )
}

export const BuySellTabButton: React.FC<
  PropsWithChildren<{
    onClick: () => void
    className?: string
    isDisabled?: boolean
    testId?: string
  }>
> = ({ onClick, children, className, isDisabled, testId }) => {
  return (
    <button
      className={`${baseStyle} h-10 rounded border border-1 border-backgrounds-300 ${className} ${isDisabled ? "opacity-10" : ""}`}
      disabled={isDisabled}
      title={isDisabled ? "Option not available for this instrument" : ""}
      onClick={
        isDisabled
          ? undefined
          : (e) => {
              e.preventDefault()
              onClick()
            }
      }
      data-testid={testId}
    >
      <span className="text-base font-semibold">{children}</span>
    </button>
  )
}
