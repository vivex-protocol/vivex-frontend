export const roundToTwo = (num: number | string) => +(Math.round(Number(num + "e+2")) + "e-2")

export const roundTo = (num: number, decimals: number) => {
  const res = +(Math.round(Number(num + `e+${decimals}`)) + `e-${decimals}`)
  return Number.isNaN(res) ? 0 : res
}
