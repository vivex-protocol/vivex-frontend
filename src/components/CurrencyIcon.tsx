import { FC, ImgHTMLAttributes } from "react"
import * as env from "../env"

export const CurrencyIcon: FC<{ currency: string } & ImgHTMLAttributes<HTMLImageElement>> = ({ currency, ...rest }) => {
  return (
    <img
      alt={`${currency} icon`}
      min-height={16}
      min-width={16}
      object-fit="cover"
      {...{ height: 16, width: 16, ...rest }} // default the size to 16x16
      src={env.BASE_URL + `currencyIcons/${currency}/icon.svg`}
    />
  )
}

export const ProtocolIcon: FC<
  {
    protocol:
      | "Yield"
      | "Contango"
      | "Uniswap"
      | "Arbitrum"
      | "Optimism"
      | "Mainnet"
      | "Localhost"
      | "Optimism"
      | "Polygon"
      | "Gnosis"
      | "Base"
  } & ImgHTMLAttributes<HTMLImageElement>
> = ({ protocol, ...rest }) => {
  return (
    <img
      alt={`${protocol} icon`}
      {...{ height: 16, width: 16, ...rest }} // default the size to 16x16
      src={env.BASE_URL + `protocolIcons/${protocol.toLowerCase()}.svg`}
    />
  )
}
