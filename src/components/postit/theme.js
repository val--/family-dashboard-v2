// Full class names, so Tailwind can see them
export const NOTE_COLORS = {
  yellow: 'bg-yellow-200',
  pink: 'bg-pink-200',
  blue: 'bg-sky-200',
  green: 'bg-green-200',
  orange: 'bg-orange-200',
  purple: 'bg-purple-200',
}

// Slightly stronger tones for the color picker dots
export const NOTE_SWATCHES = {
  yellow: 'bg-yellow-300',
  pink: 'bg-pink-300',
  blue: 'bg-sky-300',
  green: 'bg-green-300',
  orange: 'bg-orange-300',
  purple: 'bg-purple-300',
}

// "il y a 2 heures" from an epoch in seconds
export function timeAgo(epochSeconds) {
  const seconds = Math.max(0, Math.round(Date.now() / 1000 - epochSeconds))
  if (seconds < 60) return "à l'instant"
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), 'minute')
  if (seconds < 86400) return rtf.format(-Math.round(seconds / 3600), 'hour')
  return rtf.format(-Math.round(seconds / 86400), 'day')
}
