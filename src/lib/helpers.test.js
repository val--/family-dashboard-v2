import { describe, expect, it, vi, afterEach } from 'vitest'
import { shortAgo } from '../components/postit/theme'
import { entryScript, msUntilNightly } from '../hooks/useAutoReload'

afterEach(() => vi.useRealTimers())

describe('shortAgo (the age on a post-it)', () => {
  const now = new Date(2026, 9, 6, 14, 30)
  const ago = (seconds) => now / 1000 - seconds

  it.each([
    [20, "à l'instant"],
    [18 * 60, 'il y a 18 min'],
    [2 * 3600 + 600, 'il y a 2 h'],
  ])('%i seconds ago: %s', (seconds, expected) => {
    vi.useFakeTimers({ now })
    expect(shortAgo(ago(seconds))).toBe(expected)
  })

  it('says "hier" for yesterday, whatever the hour', () => {
    vi.useFakeTimers({ now })
    expect(shortAgo(new Date(2026, 9, 5, 23, 50) / 1000)).toBe('il y a 14 h') // less than a day: hours
    expect(shortAgo(new Date(2026, 9, 5, 8, 0) / 1000)).toBe('hier')
    expect(shortAgo(new Date(2026, 9, 3, 8, 0) / 1000)).toBe('il y a 3 j')
  })

  it('gives the date after two weeks', () => {
    vi.useFakeTimers({ now })
    expect(shortAgo(new Date(2026, 8, 12, 8, 0) / 1000)).toMatch(/^le 12 sept/)
  })

  it('never says a negative age when the kiosk clock is a bit late', () => {
    vi.useFakeTimers({ now })
    expect(shortAgo(ago(-30))).toBe("à l'instant")
  })
})

describe('auto reload', () => {
  it('reloads at 4:00 next, today or tomorrow', () => {
    const hour = 3600 * 1000
    expect(msUntilNightly(new Date(2026, 9, 6, 2, 0), 0)).toBe(2 * hour)
    expect(msUntilNightly(new Date(2026, 9, 6, 22, 0), 0)).toBe(6 * hour)
    expect(msUntilNightly(new Date(2026, 9, 6, 4, 0), 0)).toBe(24 * hour)
  })

  it("finds the build's entry script to notice a new deployment", () => {
    expect(entryScript('<script type="module" crossorigin src="/assets/main-B8reCOrn.js"></script>')).toBe('/assets/main-B8reCOrn.js')
    expect(entryScript('<script type="module" src="/src/main.jsx"></script>')).toBeNull() // dev server
  })
})
