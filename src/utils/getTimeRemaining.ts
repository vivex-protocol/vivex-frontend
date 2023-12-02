export const getTimeRemaining = (startDate: Date, endDate: Date) => {
  const diff = new Date(endDate.getTime() - startDate.getTime())
  const diffinMs = endDate.getTime() - startDate.getTime()
  let days, hours, minutes, seconds
  days = hours = minutes = seconds = 0
  if (diffinMs > 0) {
    days = Math.floor(diffinMs / (1000 * 60 * 60 * 24))
    hours = diff.getUTCHours()
    minutes = diff.getUTCMinutes()
    seconds = diff.getUTCSeconds()
  }
  return { days, hours, minutes, seconds }
}
