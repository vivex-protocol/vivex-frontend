import { Dialog, Transition } from "@headlessui/react"
import { Fragment, MouseEvent, createRef, useLayoutEffect, useState } from "react"

export const ActionsPanel: React.FC<{
  children: React.ReactNode
  isOpen: boolean
  setIsOpen: CallableFunction
  testIdPrefix: string
}> = ({ children, isOpen, setIsOpen, testIdPrefix }) => {
  const btnRef = createRef<HTMLButtonElement>()
  const offsetX = 200
  const [posX, setPosX] = useState(0)
  const [posY, setPosY] = useState(0)

  const setPanelPos = (el: Element) => {
    const { top, right } = el.getBoundingClientRect()
    setPosX(right - offsetX)
    const offsetY = children && Array.isArray(children) ? children.length * 33 : 100
    setPosY(top - offsetY)
  }
  function openModal() {
    setIsOpen(true)
  }

  function closeModal() {
    setIsOpen(false)
  }

  useLayoutEffect(() => {
    if (btnRef.current) {
      setPanelPos(btnRef.current)
    }
  })

  return (
    <div>
      <div className="flex justify-center">
        <button
          ref={btnRef}
          type="button"
          onClick={(e: MouseEvent) => {
            setPanelPos(e.currentTarget)
            openModal()
          }}
          data-testid={`${testIdPrefix}--action-panel`}
          className="rounded-lg border border-backgrounds-300 bg-opacity-20 text-sm font-medium text-fontColor-200 hover:text-functional-buy-500 focus:outline-none focus-visible:ring-opacity-75"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path
              fillRule="evenodd"
              d="M4.5 12a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      <Transition
        show={isOpen}
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
      >
        <Dialog
          as="div"
          onClose={closeModal}
          style={{
            left: `${posX}px`,
            top: `${posY}px`,
            width: `${offsetX}px`,
          }}
          className="fixed z-10 min-w-fit rounded-lg bg-backgrounds-0 border border-backgrounds-300 text-left px-2 py-2 drop-shadow-dropdown"
        >
          <p className="xl:sr-only pl-1 pb-1 text-fontColor-500 text-sm">Actions</p>
          <div className="flex flex-col">{children}</div>
        </Dialog>
      </Transition>
    </div>
  )
}

export const ActionButton: React.FC<
  React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & { testId?: string }
> = ({ disabled, children, className, testId, ...restProps }) => {
  const buttonClass = `"font-primary text-base text-left px-3 py-2 rounded-lg min-w-fit font-primary text-functional-buy-500 hover:text-fontColor-0 hover:bg-backgrounds-300
      ${disabled ? "opacity-50" : ""} ${className != null ? className : ""}`
  return (
    <button className={buttonClass} disabled={disabled} data-testid={testId} {...restProps}>
      {children}
    </button>
  )
}
