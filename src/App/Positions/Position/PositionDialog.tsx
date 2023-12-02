import { classNames } from "@/utils/classNames"
import { Dialog, Transition } from "@headlessui/react"
import { Fragment } from "react"

export const PositionDialog: React.FC<{
  children: React.ReactNode
  isOpen: boolean
  onClose: () => void
  className?: string
}> = ({ children, isOpen, onClose, className }) => {
  return (
    <div aria-hidden={!isOpen} data-testid="position-dialog">
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200 delay-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300 delay-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Transition.Child as={Fragment} enter="ease-out delay-[600ms] duration-300" enterFrom="opacity-0" enterTo="opacity-100">
                  <Dialog.Panel
                    className={classNames(
                      className,
                      "xl:flex text-fontColor-100 max-w-sm md:max-w-[22rem] w-full flex-col m-0 mx-auto gap-4 transform text-left align-middle shadow-xl transition-all",
                    )}
                  >
                    <div>{children}</div>
                  </Dialog.Panel>
                </Transition.Child>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}
