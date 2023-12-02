import { SecondaryButton } from "@/components/SecondaryButton"
import { classNames } from "@/utils/classNames"
import { Disclosure } from "@headlessui/react"
import { Subscribe } from "@react-rxjs/core"
import { ConnectKitButton, useModal } from "connectkit"
import { useAccount } from "wagmi"
import { ClaimRewards } from "./common/ClaimRewards"
import * as env from "../env"

interface ShellProps {
  children: React.ReactNode
}

const ConnectButton: React.FC<{ showAvatar?: boolean }> = ({ showAvatar }) => {
  const { isConnected } = useAccount()
  const modal = useModal()

  return isConnected ? (
    <ConnectKitButton showAvatar={showAvatar} />
  ) : (
    <SecondaryButton disabled={modal.open} onClick={() => modal.setOpen(true)}>
      Connect Wallet
    </SecondaryButton>
  )
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  return (
    <div>
      <div className="fixed top-0 left-0 right-0 z-10">
        <SmallNav className="sm:hidden" />
        <LargeNav className="hidden sm:flex" />
      </div>
      <main>
        <div className="p-6 pt-14 lg:pt-16 text-fontColor-0 font-primary md:h-screen mx-auto">{children}</div>
      </main>
    </div>
  )
}

const SmallNav: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <Disclosure
      as="nav"
      className={classNames(`flex w-full z-10 h-14 backdrop-blur bg-backgrounds-0/30 border-b border-b-backgrounds-300`, className)}
    >
      <div className={"max-w-7xl min-w-sm w-full mx-auto py-4 px-4 sm:px-6 lg:px-8"}>
        <div className="flex items-center justify-between h-8">
          <div className="inset-y-0 my-0 mx-auto right-0 left-0 w-fit flex-shrink-0">
            <img alt={"logo"} src={env.BASE_URL + "logo/VIVEX.svg"} />
          </div>
          <ConnectButton showAvatar={false} />
        </div>
      </div>
    </Disclosure>
  )
}

const LargeNav: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={classNames(
        "w-full z-10 flex flex-row justify-between items-center min-w-sm px-4 sm:px-6 lg:px-8 h-16 mx-0 backdrop-blur",
        className,
      )}
    >
      <div className="flex flex-row items-center gap-4">
        <img className="w-[110px] pt-2" alt={"logo"} src={env.BASE_URL + "logo/VIVEX.svg"} />
      </div>
      <div className="flex flex-row items-center gap-2 text-secondary-01">
        <Subscribe fallback={null}>
          <ClaimRewards />
        </Subscribe>
        <ConnectButton />
      </div>
    </div>
  )
}
