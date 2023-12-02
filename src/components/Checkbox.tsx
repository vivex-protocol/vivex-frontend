import { classNames } from "@/utils/classNames"
import { CheckIcon } from "@heroicons/react/24/solid"

export const Checkbox: React.FC<{
  checked: boolean
  onChange: (bool: boolean) => void
  disabled?: boolean
}> = ({ checked, onChange, disabled }) => {
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        onChange(!checked)
      }}
      disabled={disabled}
      className={classNames(
        checked ? "bg-accents-500" : "",
        "w-4 h-4 rounded border border-accents-500 flex flex-row justify-center items-center",
      )}
    >
      <CheckIcon className={classNames(checked ? "" : "invisible", "w-4 h-4 text-secondary-01")} />
    </button>
  )
}
