export const decimalSeparatorDisplay = "."
export const decimalSeparatorsInput = [".", ","]
export const decimalSeparatorRegex = ",|."

const parsingRegex = new RegExp(`^(-)?(\\d*)(${decimalSeparatorRegex}(\\d+))?$`)

export const getDecimalSeparator = (inputString: string) => {
  const parts = new RegExp(`^(-)?(\\d*)(${decimalSeparatorRegex})?((\\d+))?$`).exec(inputString)

  return parts ? parts[3] : null
}

export type FormatCurrencyOptions = {
  nDecimals: number
  padToDecimals: boolean
  decimalSeparator: string
}

const defaultOptions: FormatCurrencyOptions = {
  nDecimals: Infinity,
  padToDecimals: true,
  decimalSeparator: decimalSeparatorDisplay,
}

export const formatCurrency = (value: bigint | null, precision: number, options: Partial<FormatCurrencyOptions> = {}): string => {
  const { nDecimals, padToDecimals, decimalSeparator } = {
    ...defaultOptions,
    ...options,
  }
  if (value === null) return ""
  const precisionMultiplier = 10n ** BigInt(precision)
  if (nDecimals < precision) {
    value = value / 10n ** BigInt(precision - (nDecimals + 1))
    const rounded = Math.abs(Number(value % 10n)) > 4
    const rounding = rounded ? (value < 0 ? -1n : 1n) : 0n
    value = value / 10n + rounding
    value *= 10n ** BigInt(precision - nDecimals)
  }
  const isNegative = value < 0n
  const absValue = isNegative ? value * -1n : value
  let intPartStr = (absValue / precisionMultiplier).toString()
  if (isNegative) intPartStr = "-" + intPartStr
  const decimalPart = absValue % precisionMultiplier

  if (nDecimals === 0 || (nDecimals === Infinity && decimalPart === 0n) || (padToDecimals === false && decimalPart === 0n))
    return intPartStr

  let newDecimalPart = decimalPart.toString().padStart(precision, "0").replace(/00*$/, "")

  if (nDecimals !== Infinity && padToDecimals === true) {
    newDecimalPart = newDecimalPart.padEnd(nDecimals, "0")
  }

  return intPartStr + decimalSeparator + newDecimalPart
}

export const parseCurrency = (value: string, decimals: number): bigint | null => {
  if (!value) return null
  const parts = parsingRegex.exec(value)
  if (!parts) throw new Error(`Error parsing unnexpected currency value: ${value}`)

  const [, minus, intPartStr, , decimalPartStr] = parts

  const precisionMultiplier = 10n ** BigInt(decimals)
  const intPart = BigInt(intPartStr) * precisionMultiplier
  const decPart = decimalPartStr
    ? BigInt((decimalPartStr.length > decimals ? decimalPartStr.substring(0, decimals) : decimalPartStr).padEnd(decimals, "0"))
    : 0n

  const result = intPart + decPart

  return minus ? 0n - result : result
}
