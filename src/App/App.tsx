import { chains } from "@/api/chain"
import { ConnectKitProvider, getDefaultConfig } from "connectkit"
import { PropsWithChildren } from "react"
import { WagmiConfig, createConfig } from "wagmi"
import { CreateTicket } from "./CreateTicket/CreateTicket"
import { Positions } from "./Positions/Positions"
import { Shell } from "./Shell"
import { TradingViewChart } from "./TradingView/TradingView"
import { CustomAvatar, disclaimer } from "./Wallet/UserWallet"

const config = createConfig(
  getDefaultConfig({
    autoConnect: true,
    appName: "Vivex",
    walletConnectProjectId: "8e868e2189e028d50e53e09a3ee82f56",
    chains,
  }),
)

declare module "wagmi" {
  interface Register {
    config: typeof config
  }
}

const ConnectProvider: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <ConnectKitProvider
      customTheme={{
        "--ck-font-family": "Plus Jakarta Sans",
        "--ck-font-weight": "400",
        "--ck-border-radius": "16px",
        "--ck-overlay-backdrop-filter": "blur(0px)",
        "--ck-modal-heading-font-weight": "500",
        "--ck-qr-border-radius": "12px",
        "--ck-connectbutton-font-size": "12px",
        "--ck-connectbutton-color": "#ffffff",
        "--ck-connectbutton-background": "#272A3A",
        "--ck-connectbutton-background-secondary": "#FFFFFF",
        "--ck-connectbutton-border-radius": "8px",
        "--ck-connectbutton-box-shadow": "0 0 0 0 #ffffff",
        "--ck-connectbutton-hover-color": "#ffffff",
        "--ck-connectbutton-hover-background": "#292C3D",
        "--ck-connectbutton-hover-box-shadow": "0 0 0 0 #ffffff",
        "--ck-connectbutton-active-color": "#ffffff",
        "--ck-connectbutton-active-background": "#141622",
        "--ck-connectbutton-active-box-shadow": "0 0 0 0 #ffffff",
        "--ck-connectbutton-balance-color": "#373737",
        "--ck-connectbutton-balance-background": "#fff",
        "--ck-connectbutton-balance-box-shadow": "inset 0 0 0 1px #F6F7F9",
        "--ck-connectbutton-balance-hover-background": "#F6F7F9",
        "--ck-connectbutton-balance-hover-box-shadow": "inset 0 0 0 1px #F0F2F5",
        "--ck-connectbutton-balance-active-background": "#F0F2F5",
        "--ck-connectbutton-balance-active-box-shadow": "inset 0 0 0 1px #EAECF1",
        "--ck-primary-button-font-weight": "400",
        "--ck-primary-button-border-radius": "12px",
        "--ck-primary-button-color": "#FFFFFF",
        "--ck-primary-button-background": "#272A3A",
        "--ck-primary-button-box-shadow": "0 0 0 0 #ffffff",
        "--ck-primary-button-hover-color": "#FFFFFF",
        "--ck-primary-button-hover-background": "#292C3D",
        "--ck-primary-button-hover-box-shadow": "0 0 0 0 #ffffff",
        "--ck-primary-button-active-color": "#ffffff",
        "--ck-primary-button-active-background": "#292C3D",
        "--ck-primary-button-active-box-shadow": "0 0 0 0 #ffffff",
        "--ck-secondary-button-font-weight": "500",
        "--ck-secondary-button-border-radius": "8px",
        "--ck-secondary-button-color": "#ffffff",
        "--ck-secondary-button-background": "none",
        "--ck-secondary-button-box-shadow": "0px 0px 0px 2px #292C3D",
        "--ck-secondary-button-hover-color": "#ffffff",
        "--ck-secondary-button-hover-background": "#292C3D",
        "--ck-secondary-button-hover-box-shadow": "0px 0px 0px 2px #292C3D",
        "--ck-secondary-button-active-color": "#373737",
        "--ck-secondary-button-active-background": "#292C3D",
        "--ck-secondary-button-active-box-shadow": "0px 0px 0px 2px #292C3D",
        "--ck-tertiary-button-font-weight": "500",
        "--ck-tertiary-button-border-radius": "16px",
        "--ck-tertiary-button-color": "#373737",
        "--ck-tertiary-button-background": "#8d9fc2",
        "--ck-tertiary-button-box-shadow": "0 0 0 0 #ffffff",
        "--ck-tertiary-button-hover-color": "#373737",
        "--ck-tertiary-button-hover-background": "#a1afcb",
        "--ck-tertiary-button-hover-box-shadow": "0 0 0 0 #ffffff",
        "--ck-tertiary-button-active-color": "#373737",
        "--ck-tertiary-button-active-background": "#F6F7F9",
        "--ck-tertiary-button-active-box-shadow": "0 0 0 0 #ffffff",
        "--ck-modal-box-shadow": "0px 0px 0px 1px #292C3D",
        "--ck-overlay-background": "#1d1f2bf0",
        "--ck-body-color": "#ffffff",
        "--ck-body-color-muted": "#B7BABC",
        "--ck-body-color-muted-hover": "#ffffff",
        "--ck-body-background": "#1A1C28",
        "--ck-body-background-transparent": "rgba(255,255,255,0)",
        "--ck-body-background-secondary": "none",
        "--ck-body-background-secondary-hover-background": "#e0e4eb",
        "--ck-body-background-secondary-hover-outline": "#4282FF",
        "--ck-body-background-tertiary": "none",
        "--ck-body-action-color": "#93989A",
        "--ck-body-divider": "#292C3D",
        "--ck-body-color-danger": "#e42548",
        "--ck-body-color-valid": "#64B966",
        "--ck-siwe-border": "#F0F0F0",
        "--ck-tooltip-background": "#141622",
        "--ck-tooltip-background-secondary": "#272A3A",
        "--ck-tooltip-color": "#93989A",
        "--ck-tooltip-shadow": "5px 5px 12px 5px #1d1f2b73",
        "--ck-dropdown-button-color": "#999999",
        "--ck-dropdown-button-box-shadow": "0 0 0 1px rgba(0,0,0,0.01), 0px 0px 7px rgba(0, 0, 0, 0.05)",
        "--ck-dropdown-button-background": "#fff",
        "--ck-dropdown-button-hover-color": "#8B8B8B",
        "--ck-dropdown-button-hover-background": "#F5F7F9",
        "--ck-qr-dot-color": "#1D1F2B",
        "--ck-qr-background": "#FFFFFF",
        "--ck-qr-border-color": "#F3F3F3",
        "--ck-focus-color": "#6271EB",
        "--ck-spinner-color": "#6271EB",
        "--ck-copytoclipboard-stroke": "#CCCCCC",
        "--ck-recent-badge-color": "#4DFFE0",
        "--ck-recent-badge-background": "none",
        "--ck-recent-badge-border-radius": "32px",
      }}
      options={{
        disclaimer,
        hideQuestionMarkCTA: true,
        customAvatar: CustomAvatar,
        walletConnectName: "Wallet Connect",
        enforceSupportedChains: false,
      }}
    >
      {children}
    </ConnectKitProvider>
  )
}

export function App() {
  return (
    <div className="w-full h-full bg-backgrounds-0">
    <WagmiConfig config={config}>
      <ConnectProvider>
        <Shell>
          <div className="p-2 flex flex-col lg:flex-row gap-2 h-full">
            <div className="h-full flex-1 flex flex-col gap-2 lg:w-96">
              <div className="h-80 hidden lg:block lg:h-2/3 w-full">
                <TradingViewChart />
              </div>
              <div className="lg:h-1/3 w-full md:pb-0">
                <Positions />
              </div>
            </div>
            <div className="w-full lg:w-[22rem] rounded-lg">
              <CreateTicket />
            </div>
          </div>
        </Shell>
      </ConnectProvider>
    </WagmiConfig>
    </div>
  )
}
