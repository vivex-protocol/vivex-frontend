import { ZeusScalars } from "../zeus"

export const scalars = ZeusScalars({
  BigDecimal: {
    decode: (decimal) => decimal as string,
  },
  BigInt: {
    decode: (val) => val as string,
  },
  Bytes: {
    decode: (bytes) => bytes as string,
  },
})

export function decimalToBigint(decimal: string, precision: number = 18): bigint {
  try {
    const [integer, fractional = ""] = decimal.split(".")
    return BigInt(integer + fractional.slice(0, precision).padEnd(precision, "0"))
  } catch {
    return BigInt(decimal + "0".repeat(precision))
  }
}
