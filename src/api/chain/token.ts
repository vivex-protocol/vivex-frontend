import { ReturnPromiseType } from "@/utils/types"
import { encodeAbiParameters, fromHex, Hex, keccak256, toHex } from "viem"
import { WalletClient } from "wagmi"
import { SupportedChainIds } from "./contango"

export const PERMIT2_ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3"

const signData = async (fromAddress: Hex, data: string, walletClient: WalletClient) => {
  const result = await walletClient.request({
    method: "eth_signTypedData_v4",
    params: [fromAddress, data],
  })
// @ts-ignore
  const r = fromHex(`0x${result?.slice(2, 66)}`, { to: "bytes" })
  // @ts-ignore
  const s = fromHex(`0x${result?.slice(66, 130)}`, { to: "bytes" })
  // @ts-ignore
  let v = BigInt("0x" + result?.slice(130, 132))
  // @ts-ignore
  let vs = fromHex(`0x${result?.slice(66, 130)}`, { to: "bytes" })

  const recoveryParam = 1 - (Number(v) % 2)

  if (v < 27n) {
    if (v === 0n || v === 1n) v += 27n
    else throw new Error(`signature invalid v byte: ${v} signature: ${result}`)
  }

  if (recoveryParam) {
    vs[0] |= 0x80
  }

  return { v, r: toHex(r), s, vs: toHex(vs) }
}

const oneDay = 86_400

const getVersion = (chainId: SupportedChainIds, token: Hex) => {
  if ([31337, 42161, 10].includes(chainId) && token.toLowerCase() === "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1".toLowerCase()) return "2"
  if (chainId === 1 && token.toLowerCase() === "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48".toLowerCase()) return "2"
  if (chainId === 42161 && token.toLowerCase() === "0xaf88d065e77c8cC2239327C5EDb3A432268e5831".toLowerCase()) return "2"
  return "1"
}

const isLegacyDomain = (chainId: SupportedChainIds, token: Hex) => {
  const usdcOnPolygon = 137 === chainId && token.toLowerCase() === "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
  return usdcOnPolygon
}

export const signERC2612Permit = async (
  token: Hex,
  amount: bigint,
  owner: Hex,
  spender: Hex,
  chainId: SupportedChainIds,
  tokenName: string,
  nonce: number,
  walletClient: WalletClient,
  usePermit2: boolean,
) => {
  let typedData = {}
  let deadline = BigInt(Math.floor(Date.now() / 1000 + oneDay))

  if (usePermit2) {
    const nonce = keccak256(
      encodeAbiParameters(
        [
          { name: "to", type: "address" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint" },
          { name: "deadline", type: "uint" },
        ],
        [owner, token, amount, deadline],
      ),
      "hex",
    )

    typedData = {
      types: {
        PermitTransferFrom: [
          {
            type: "TokenPermissions",
            name: "permitted",
          },
          {
            type: "address",
            name: "spender",
          },
          {
            type: "uint256",
            name: "nonce",
          },
          {
            type: "uint256",
            name: "deadline",
          },
        ],
        TokenPermissions: [
          {
            type: "address",
            name: "token",
          },
          {
            type: "uint256",
            name: "amount",
          },
        ],
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
      },
      domain: {
        name: "Permit2",
        chainId,
        verifyingContract: PERMIT2_ADDRESS,
      },
      primaryType: "PermitTransferFrom",
      message: {
        permitted: {
          token,
          amount: amount.toString(),
        },
        spender,
        deadline: deadline.toString(),
        nonce,
      },
    }
  } else {
    // This is a bit hacky, but will have to do for now. This check will be moved to the generated.ts structure in near future.
    const version = getVersion(chainId, token)

    const legacyDomain = isLegacyDomain(chainId, token)
    const domain = legacyDomain
      ? {
          name: tokenName,
          version,
          salt: toHex(chainId, { size: 32 }),
          verifyingContract: token,
        }
      : {
          name: tokenName,
          version,
          chainId: Number(chainId),
          verifyingContract: token,
        }

    const message = {
      owner,
      spender,
      value: amount,
      nonce,
      deadline,
    }

    typedData = {
      types: {
        EIP712Domain: legacyDomain
          ? [
              { name: "name", type: "string" },
              { name: "version", type: "string" },
              { name: "verifyingContract", type: "address" },
              { name: "salt", type: "bytes32" },
            ]
          : [
              { name: "name", type: "string" },
              { name: "version", type: "string" },
              { name: "chainId", type: "uint256" },
              { name: "verifyingContract", type: "address" },
            ],
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Permit",
      domain,
      message: {
        ...message,
        value: amount.toString(),
        nonce: nonce.toString(),
        deadline: message.deadline.toString(),
      },
    }
  }

  const { r, vs } = await signData(owner, JSON.stringify(typedData), walletClient)
  return { r, vs, amount, deadline, isPermit2: usePermit2 }
}

export type SignedPermit = ReturnPromiseType<typeof signERC2612Permit>
