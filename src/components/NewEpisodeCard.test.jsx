import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import NewEpisodeCard from './NewEpisodeCard'

afterEach(cleanup)

const base = { key: '1', show: 'MobLand', season: 2, episode: 3, title: 'Bonzo', addedAt: 1790000000, count: 1, showSummary: 'La série.' }

describe('NewEpisodeCard (no spoiler)', () => {
  it('reminds the episode just before, with its recap', () => {
    const previously = { season: 2, episode: 2, distance: 1, recap: 'Harry a disparu.', summary: 'Teaser.' }
    const { container } = render(<NewEpisodeCard episode={{ ...base, watched: false, summary: null, previously }} />)
    expect(container.textContent).toContain("Dans l'épisode précédent")
    expect(container.textContent).toContain('S2E2')
    expect(container.textContent).toContain('Harry a disparu.')
  })

  it('says how many episodes back, and shows Plex\'s summary until the recap is written', () => {
    const previously = { season: 1, episode: 10, distance: 3, recap: null, summary: 'Kevin règle un problème.' }
    const { container } = render(<NewEpisodeCard episode={{ ...base, watched: false, summary: null, previously }} />)
    expect(container.textContent).toContain('Il y a 3 épisodes')
    expect(container.textContent).toContain('Kevin règle un problème.')
  })

  it("shows the episode's own summary once it was watched", () => {
    const { container } = render(<NewEpisodeCard episode={{ ...base, watched: true, summary: 'Ce qui arrive.', previously: null }} />)
    expect(container.textContent).toContain('Ce qui arrive.')
    expect(container.textContent).not.toContain('Il y a')
  })
})
