import { ContangoSDK } from "@/vivex-xyz/sdk"
import { PublicClientConfig, WebSocketTransport, http, webSocket } from "viem"
import { arbitrum, base, gnosis, localhost, mainnet, optimism, polygon } from "wagmi/chains"
import { customFallback } from "./customFallback"

const graphUrls = (network: string) => {
  switch (network) {
    case "base":
      return ["https://graph.contango.xyz:18000/subgraphs/name/contango-xyz/v2-base"]
    default:
      return [`https://api.thegraph.com/subgraphs/name/burner0621/v2-${network}`]
  }
}

const wagmiRpcs = {
  42161: {
    http: ["https://arb-mainnet.g.alchemy.com/v2/77lH3uDprfEKAXX2NbZ3WHfZ4g3m7TP6"],
    webSocket: ["wss://arb-mainnet.g.alchemy.com/v2/77lH3uDprfEKAXX2NbZ3WHfZ4g3m7TP6"],
  },
  1: {
    http: ["https://eth-mainnet.g.alchemy.com/v2/6Ic0SMLQ7V4p7H4w5SE-mrIvhKY53epW"],
    webSocket: ["wss://eth-mainnet.g.alchemy.com/v2/6Ic0SMLQ7V4p7H4w5SE-mrIvhKY53epW"],
  },
  137: {
    http: ["https://polygon-mainnet.g.alchemy.com/v2/LHmxcUv_c6vO8xBBOm1LFKX0X2a1Szey"],
    webSocket: ["wss://polygon-mainnet.g.alchemy.com/v2/LHmxcUv_c6vO8xBBOm1LFKX0X2a1Szey"],
  },
  10: {
    http: ["https://opt-mainnet.g.alchemy.com/v2/WvFrL4ik6gff5SDA3lbdbu7UaBN1A1KC"],
    webSocket: ["wss://opt-mainnet.g.alchemy.com/v2/WvFrL4ik6gff5SDA3lbdbu7UaBN1A1KC"],
  },
  100: {
    http: ["https://gnosis-mainnet.chainnodes.org/d27f689b-6e0f-4cec-b766-acf2a2edca1b"],
    webSocket: ["wss://gnosis-mainnet.chainnodes.org/d27f689b-6e0f-4cec-b766-acf2a2edca1b"],
  },
  8453: {
    http: ["https://base-mainnet.g.alchemy.com/v2/F690Mbr80nz9apMWC4Hjs8DuImzNJOmE"],
    webSocket: ["wss://base-mainnet.g.alchemy.com/v2/F690Mbr80nz9apMWC4Hjs8DuImzNJOmE"],
  },
} as const

const getWagmiRpcConfig = (id: keyof typeof wagmiRpcs) => ({ default: wagmiRpcs[id] })

const arbitrumLocalRpcUrls = {
  default: {
    http: ["http://localhost:8546"] as const,
  } as const,
  public: {
    http: ["http://localhost:8546"] as const,
  } as const,
} as const
const localhostArbitrum = {
  ...arbitrum,
  graphUrls: [`http://localhost:8000/subgraphs/name/contango-xyz/v2-arbitrum`],
  ...localhost,
  rpcUrls: arbitrumLocalRpcUrls,
  id: 31337,
  name: "LocalhostArbitrum",
} as const
const arbitrumOne = {
  ...arbitrum,
  rpcUrls: { ...arbitrum.rpcUrls, ...getWagmiRpcConfig(arbitrum.id) },
  graphUrls: graphUrls("arbitrum"),
}

const optimismLocalRpcUrls = {
  default: {
    http: ["http://localhost:8547"] as const,
  } as const,
  public: {
    http: ["http://localhost:8547"] as const,
  } as const,
} as const
const localhostOptimism = {
  ...optimism,
  graphUrls: [`http://localhost:9000/subgraphs/name/contango-xyz/v2-optimism`],
  ...localhost,
  rpcUrls: optimismLocalRpcUrls,
  id: 31338,
  name: "LocalhostOptimism",
} as const
const optimismMainnet = {
  ...optimism,
  rpcUrls: { ...optimism.rpcUrls, ...getWagmiRpcConfig(optimism.id) },
  graphUrls: graphUrls("optimism"),
}

const mainnetLocalRpcUrls = {
  default: {
    http: ["http://localhost:8548"] as const,
  } as const,
  public: {
    http: ["http://localhost:8548"] as const,
  } as const,
} as const
const localhostMainnet = {
  ...mainnet,
  graphUrls: [`http://localhost:10000/subgraphs/name/contango-xyz/v2-mainnet`],
  ...localhost,
  rpcUrls: mainnetLocalRpcUrls,
  id: 31339,
  name: "LocalhostMainnet",
} as const
const ethereumMainnet = {
  ...mainnet,
  rpcUrls: { ...mainnet.rpcUrls, ...getWagmiRpcConfig(mainnet.id) },
  graphUrls: graphUrls("mainnet"),
}

const polygonLocalRpcUrls = {
  default: {
    http: ["http://localhost:8549"] as const,
  } as const,
  public: {
    http: ["http://localhost:8549"] as const,
  } as const,
} as const
const localhostPolygon = {
  ...polygon,
  graphUrls: [`http://localhost:11000/subgraphs/name/contango-xyz/v2-polygon`],
  ...localhost,
  rpcUrls: polygonLocalRpcUrls,
  id: 31340,
  name: "LocalhostPolygon",
} as const
const polygonMainnet = {
  ...polygon,
  rpcUrls: { ...polygon.rpcUrls, ...getWagmiRpcConfig(polygon.id) },
  graphUrls: graphUrls("polygon"),
}

const gnosisMainnet = {
  ...gnosis,
  blockExplorers: {
    default: gnosis.blockExplorers.etherscan,
  },
  rpcUrls: { ...gnosis.rpcUrls, ...getWagmiRpcConfig(gnosis.id) },
  graphUrls: graphUrls("gnosis"),
}

const baseMainnet = {
  ...base,
  rpcUrls: { ...base.rpcUrls, ...getWagmiRpcConfig(base.id) },
  graphUrls: graphUrls("base"),
}

const allChains = [
  arbitrumOne,
  // localhostArbitrum,
  optimismMainnet,
  // localhostOptimism,
  ethereumMainnet,
  // localhostMainnet,
  polygonMainnet,
  // localhostPolygon,
  gnosisMainnet,
  baseMainnet,
]
export const chains = window.location.href.includes("vivex.io")
  ? ([arbitrumOne, optimismMainnet, ethereumMainnet, polygonMainnet, gnosisMainnet, baseMainnet] as typeof allChains)
  : allChains

export const chainsMap = new Map(chains.map((x) => [x.id, x]))

export type SupportedChainIds =
  | typeof arbitrumOne.id
  | typeof localhostArbitrum.id
  | typeof optimismMainnet.id
  | typeof localhostOptimism.id
  | typeof ethereumMainnet.id
  | typeof localhostMainnet.id
  | typeof polygonMainnet.id
  | typeof localhostPolygon.id
  | typeof gnosisMainnet.id
  | typeof baseMainnet.id

const chainnodesHttp = (host: string) => http(`https://${host}.chainnodes.org/d27f689b-6e0f-4cec-b766-acf2a2edca1b`, { name: "chainnodes" })

export const publicClientConfigsById: Record<SupportedChainIds, PublicClientConfig & { wsTransport?: WebSocketTransport }> = {
  42161: {
    chain: arbitrum,
    wsTransport: webSocket("wss://arb-mainnet.g.alchemy.com/v2/77lH3uDprfEKAXX2NbZ3WHfZ4g3m7TP6", { name: "alchemy" }),
    transport: customFallback([
      chainnodesHttp("arbitrum-one"),
      http("https://arb-mainnet.g.alchemy.com/v2/77lH3uDprfEKAXX2NbZ3WHfZ4g3m7TP6", { name: "alchemy" }),
      http("https://arbitrum.llamarpc.com", { name: "llama-nodes" }),
      http("https://arb1.arbitrum.io/rpc"),
    ]),
  },
  31337: {
    chain: localhostArbitrum,
    wsTransport: webSocket("ws://localhost:8546"),
    transport: http("http://localhost:8546"),
  },
  10: {
    chain: optimism,
    wsTransport: webSocket("wss://opt-mainnet.g.alchemy.com/v2/WvFrL4ik6gff5SDA3lbdbu7UaBN1A1KC"),
    transport: customFallback([
      http("https://opt-mainnet.g.alchemy.com/v2/WvFrL4ik6gff5SDA3lbdbu7UaBN1A1KC"),
      chainnodesHttp("optimism-mainnet"),
      http("https://optimism.llamarpc.com"),
      http("https://mainnet.optimism.io"),
    ]),
  },
  31338: {
    chain: localhostOptimism,
    wsTransport: webSocket("ws://localhost:8547"),
    transport: http("http://localhost:8547"),
  },
  1: {
    chain: mainnet,
    wsTransport: webSocket("wss://eth-mainnet.g.alchemy.com/v2/6Ic0SMLQ7V4p7H4w5SE-mrIvhKY53epW"),
    transport: customFallback([
      http("https://eth-mainnet.g.alchemy.com/v2/6Ic0SMLQ7V4p7H4w5SE-mrIvhKY53epW"),
      chainnodesHttp("mainnet"),
      http("https://eth.llamarpc.com"),
      http("https://ethereum.publicnode.com"),
    ]),
  },
  31339: {
    chain: localhostMainnet,
    wsTransport: webSocket("ws://localhost:8548"),
    transport: http("http://localhost:8548"),
  },
  137: {
    chain: polygon,
    wsTransport: webSocket("wss://polygon-mainnet.g.alchemy.com/v2/LHmxcUv_c6vO8xBBOm1LFKX0X2a1Szey"),
    transport: customFallback([
      http("https://polygon-mainnet.g.alchemy.com/v2/LHmxcUv_c6vO8xBBOm1LFKX0X2a1Szey"),
      chainnodesHttp("polygon-mainnet"),
      http("https://polygon.llamarpc.com"),
      http("https://polygon.gateway.tenderly.co/4hX6i4t4mRyEvSKRB2Zhxy"),
    ]),
  },
  31340: {
    chain: localhostPolygon,
    wsTransport: webSocket("ws://localhost:8549"),
    transport: http("http://localhost:8549"),
  },
  100: {
    chain: gnosis,
    transport: customFallback([
      chainnodesHttp("gnosis-mainnet"),
      http("https://rpc.gnosis.gateway.fm"),
      http("https://rpc.gnosischain.com"),
    ]),
  },
  8453: {
    chain: base,
    wsTransport: webSocket("wss://base-mainnet.g.alchemy.com/v2/F690Mbr80nz9apMWC4Hjs8DuImzNJOmE"),
    transport: customFallback([
      http("https://base-mainnet.g.alchemy.com/v2/F690Mbr80nz9apMWC4Hjs8DuImzNJOmE"),
      http("https://mainnet.base.org"),
      http("https://base.llamarpc.com"),
    ]),
  },
}

// TODO: we need a central place where we define the types of chains and ids
export const publicClientConfigsByName: Record<string, PublicClientConfig> = {
  arbitrum: publicClientConfigsById[arbitrumOne.id],
  optimism: publicClientConfigsById[optimismMainnet.id],
  mainnet: publicClientConfigsById[ethereumMainnet.id],
  polygon: publicClientConfigsById[polygonMainnet.id],
}

export const contangoSdk = ContangoSDK(Object.values(publicClientConfigsById), true || window.location.href.includes("vivex.io"))
