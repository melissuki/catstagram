/** Compact relative time: 2m ago / 3s / 1h / 4d */
export function formatRelativeTime(
  iso: string,
  language: 'en' | 'tr' = 'en',
): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const sec = Math.max(0, Math.floor(diffMs / 1000))

  if (language === 'tr') {
    if (sec < 60) return `${sec}sn`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}dk`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}sa`
    const day = Math.floor(hr / 24)
    return `${day}g`
  }

  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}
