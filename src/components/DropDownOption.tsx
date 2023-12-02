import { classNames } from "@/utils/classNames"
import { Listbox } from "@headlessui/react"

export const DropDownOption: React.FC<{
  valueId: string
  className?: string
  children: React.ReactNode
}> = ({ valueId, children, className }) => {
  return (
    <Listbox.Option key={valueId} value={valueId}>
      {({ active, selected }) => (
        <div
          className={classNames(
            className,
            active ? "text-fontColor-0 bg-backgrounds-300" : selected ? "text-white" : "text-fontColor-300",
            "cursor-pointer relative select-none p-2 rounded-lg flex items-center font-primary",
          )}
        >
          {children}
        </div>
      )}
    </Listbox.Option>
  )
}
