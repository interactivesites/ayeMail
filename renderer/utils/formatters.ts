type DateLike = number | string | Date | undefined | null

const DEFAULT_LOCALE = undefined

export const formatDate = (value: DateLike, options?: Intl.DateTimeFormatOptions) => {
  if (value === undefined || value === null) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString(DEFAULT_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(options || {})
  })
}

export const formatSize = (bytes?: number | null) => {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '—'

  const thresholds = [
    { unit: 'GB', value: 1024 ** 3 },
    { unit: 'MB', value: 1024 ** 2 },
    { unit: 'KB', value: 1024 },
  ]

  if (bytes < 1024) return `${bytes} B`

  for (const { unit, value } of thresholds) {
    if (bytes >= value) {
      return `${(bytes / value).toFixed(1)} ${unit}`
    }
  }

  return `${bytes} B`
}

export const formatAddresses = (addresses?: any[]) => {
  if (!addresses || addresses.length === 0) return '—'

  const formatted = addresses
    .map((addr) => {
      if (!addr) return ''
      const name = typeof addr.name === 'string' ? addr.name.trim() : ''
      const address = typeof addr.address === 'string' ? addr.address.trim() : ''

      if (name && address) return `${name} <${address}>`
      if (address) return address
      if (name) return name
      return ''
    })
    .filter((value) => value && value.length > 0)

  return formatted.length ? formatted.join(', ') : '—'
}

export const formatTime = (timestamp: number | string | Date) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  // Maybe we use this later
  // const now = new Date()
  // const diff = now.getTime() - date.getTime()
  // const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  // if (days === 0) {
  //   // Today - show time
  //   return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  // } else if (days === 1) {
  //   // Yesterday
  //   return 'Yesterday'
  // } else if (days < 7) {
  //   // This week - show weekday
  //   return date.toLocaleDateString([], { weekday: 'short' })
  // } else {
  //   // Older - show date
  //   return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  // }
}
