export function classNames(...classes: Array<string | null | undefined | false | 0 | 0n>): string {
  return classes.filter(Boolean).join(" ")
}
