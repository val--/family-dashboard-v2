import { useEffect, useRef, useState } from 'react'

const NIGHTLY_HOUR = 4 // full reload every night: frees the memory Chrome slowly piles up on the Pi
const VERSION_CHECK_MS = 5 * 60 * 1000

// Milliseconds until the next NIGHTLY_HOUR:00 (plus a few random minutes, so every screen doesn't
// reload at the very same second)
export function msUntilNightly(now = new Date(), jitterMs = Math.random() * 10 * 60 * 1000) {
  const next = new Date(now)
  next.setHours(NIGHTLY_HOUR, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next - now + jitterMs
}

// The built entry script, e.g. /assets/main-B8reCOrn.js: its name changes with every deployment
export function entryScript(html) {
  const match = html.match(/<script[^>]+src="([^"]*\/assets\/[^"]+\.js)"/)
  return match ? match[1] : null
}

// Reloads the page every night, and after a new deployment once the screen is idle (never in someone's
// hands). The current tab survives: it is kept in the URL.
export function useAutoReload(idle, reload = () => window.location.reload()) {
  const [updateReady, setUpdateReady] = useState(false)
  const current = useRef(null)

  useEffect(() => {
    const timer = setTimeout(reload, msUntilNightly())
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    current.current = entryScript(document.documentElement.outerHTML)
    if (!current.current) return undefined // dev server: nothing to compare
    const check = async () => {
      try {
        const res = await fetch(`${window.location.pathname}?v=${Date.now()}`, { cache: 'no-store' })
        const latest = entryScript(await res.text())
        if (latest && latest !== current.current) setUpdateReady(true)
      } catch {
        // offline for a moment: try again next time
      }
    }
    const interval = setInterval(check, VERSION_CHECK_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (updateReady && idle) reload()
  }, [updateReady, idle]) // eslint-disable-line react-hooks/exhaustive-deps
}
