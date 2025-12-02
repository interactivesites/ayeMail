// Date and time formatting helpers

export type FormatDateStyle = 'relative' | 'time' | 'short' | 'long'

export function formatDate(
  dateInput: Date | string | number,
  opts?: { now?: Date; style?: FormatDateStyle }
): string {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
  const now = opts?.now ?? new Date()
  const style = opts?.style

  if (style === 'relative') return toRelative(d, now)
  if (style === 'time') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (style === 'long') return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
  // default short
  return d.toLocaleDateString()
}

export function toRelative(date: Date, now = new Date()): string {
  const diffMs = date.getTime() - now.getTime()
  const absMs = Math.abs(diffMs)
  const sec = Math.round(absMs / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)

  const suffix = diffMs < 0 ? 'ago' : 'from now'
  if (sec < 45) return `just now`
  if (min < 2) return `a minute ${suffix}`
  if (min < 45) return `${min} minutes ${suffix}`
  if (hr < 2) return `an hour ${suffix}`
  if (hr < 22) return `${hr} hours ${suffix}`
  if (day < 2) return `a day ${suffix}`
  return `${day} days ${suffix}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
