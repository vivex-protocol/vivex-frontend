import { Types, useModal } from "connectkit"
import Jazzicon, { jsNumberForAddress } from "react-jazzicon"
import { useAccount, useEnsAvatar, useEnsName } from "wagmi"

const trunc = (address: string) => `${address.slice(0, 5)}...${address.slice(-4)}`

export const UserWallet: React.FC = () => {
  const modal = useModal()
  const { address, isConnected } = useAccount()
  const { data: ensName } = useEnsName({ address })
  const { data: ensImage } = useEnsAvatar({ name: ensName })

  return isConnected && address ? (
    <span
      onClick={() => modal.setOpen(true)}
      className="h-full flex flex-row items-center gap-1 px-3 py-0.5 text-base font-medium hover:text-accents-500 cursor-pointer font-secondary text-secondary-01"
    >
      <CustomAvatar address={address} ensImage={ensImage!} size={32} />
      <span className="hidden lg:flex">{ensName ? `${ensName} (${trunc(address)})` : trunc(address)}</span>
    </span>
  ) : null
}

export const CustomAvatar = ({ address, ensImage, size }: Omit<Types.CustomAvatarProps, "radius">) => {
  if (!address) return null
  return ensImage ? (
    <img style={{ height: size, width: size }} className={`rounded-full`} src={ensImage} />
  ) : (
    <Jazzicon diameter={size} seed={jsNumberForAddress(address)} />
  )
}

const _styles = "text-accents-400 underline whitespace-nowrap"
export const disclaimer = (
  <div className="flex flex-col text-fontColor-0 text-sm gap-1 mx-[-20px]">
    <span>
      By connecting your wallet you agree to the our{" "}
      <a className={_styles} href="https://docs.google.com/document/d/1Spd46_JTQtyUehzSHj0PwCo2E1ilwHZdD-h7T3Wwe_I/edit?usp=sharing">
        Terms and Conditions
      </a>{" "}
      and our{" "}
      <a className={_styles} href="https://docs.google.com/document/d/1N9iS0Ib9H2-tI-1OwQSfG_s5QZyav_r4JXruiVPex88/edit?usp=sharing">
        Privacy Policy
      </a>
      .
    </span>
  </div>
)
