import { classNames } from "@/utils/classNames"
import { Listbox, Transition } from "@headlessui/react"
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid"
import React, { Fragment } from "react"

export const DropDown: React.FC<{
  selectedId: string
  displayValue: React.ReactNode
  children: React.ReactNode
  className?: string
  onChange: (keyId: string) => void
}> = ({ selectedId, displayValue, className, children, onChange }) => {
  return (
    <Listbox
      value={selectedId}
      onChange={(e) => {
        if (e !== selectedId) onChange(e)
      }}
    >
      {({ open }) => (
        <div
          data-testid="dropdown"
          className={classNames("relative inline-block rounded-10 h-fit font-secondary font-normal max-w-[350px]", className)}
        >
          <Listbox.Button className="flex w-full cursor-pointer px-1 text-left rounded-10 focus:outline-none focus:ring-1 focus:ring-functional-buy-500 gap-2 justify-between items-center text-sm">
            {displayValue}
            {open ? <ChevronUpIcon className="h-5 w-5" aria-hidden="true" /> : <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />}
          </Listbox.Button>

          <Transition
            show={open}
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Listbox.Options
              data-testid="dropdown--options"
              className={classNames(
                className,
                "absolute z-10 p-2 w-full min-w-fit overflow-auto rounded-lg bg-backgrounds-0 drop-shadow-dropdown ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm max-h-[275px]",
              )}
            >
              {children}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  )
}
