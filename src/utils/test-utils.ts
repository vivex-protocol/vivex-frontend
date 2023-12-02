export const withPrefix = (str: string, prefix?: string) => {
  return prefix ? prefix + "--" + str : str
}
