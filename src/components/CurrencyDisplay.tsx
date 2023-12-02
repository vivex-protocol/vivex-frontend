interface DisplayOptions {
  padDecimals?: boolean
  formatAsDelta?: boolean
  showZero?: boolean
  dust?: boolean
}

const defaultOptions: DisplayOptions = {
  padDecimals: true,
  formatAsDelta: false,
  showZero: false,
  dust: true,
}
export const toDisplayValue = (
  value: bigint | number,
  { decimals, displayDecimals }: { decimals: number; displayDecimals: number },
  options = defaultOptions,
) => {
  const { padDecimals, formatAsDelta, showZero, dust } = {
    ...defaultOptions,
    ...options,
  }
  if (value === 0 || value === 0n) {
    return showZero ? "0." + "0".repeat(displayDecimals) : ""
  }

  const num = typeof value === "number" ? value : Number(value) / 10 ** decimals
  const minimumFractionDigits = padDecimals ? displayDecimals : undefined
  const signDisplay = formatAsDelta ? "always" : "auto"
  const res = num.toLocaleString(undefined, {
    notation: "standard",
    minimumFractionDigits,
    signDisplay,
    maximumFractionDigits: displayDecimals,
  })

  if (dust && Number(res) === 0) {
    return "<0." + "0".repeat(displayDecimals - 1) + "1"
  }
  return res
}

export const toDisplayValue2 = (
  value: bigint | number,
  { decimals, displayDecimals }: { decimals: number; displayDecimals: number },
  options = defaultOptions,
) => {
  const { padDecimals, formatAsDelta, showZero } = {
    ...defaultOptions,
    ...options,
  }
  if (value === 0 || value === 0n) {
    return showZero ? "0." + "0".repeat(displayDecimals) : ""
  }
  const num = typeof value === "number" ? value : Number(value) / 10 ** decimals
  const minimumFractionDigits = padDecimals ? displayDecimals : undefined
  const signDisplay = formatAsDelta ? "always" : "auto"
  const option1 = num.toLocaleString(undefined, {
    notation: "standard",
    minimumFractionDigits,
    signDisplay,
    maximumFractionDigits: displayDecimals,
  })
  const option2 = num.toLocaleString(undefined, {
    notation: "standard",
    signDisplay,
    maximumSignificantDigits: displayDecimals,
  })

  return option1.length >= option2.length ? option1 : option2
}

export const toCurrencyDisplay = (
  value: bigint,
  asset: { decimals: number; displayDecimals: number; symbol: string },
  options?: DisplayOptions,
) => (
  <span className="whitespace-nowrap">
    {toDisplayValue(value, asset, options)}
    {value === 0n ? null : <span className="text-fontColor-500">{`${" " + asset.symbol}`}</span>}
  </span>
)
