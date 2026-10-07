import { describe, expect, it } from 'vitest'
import { sceneSwatch, shortcutScenes } from './hue'

const rooms = [
  { name: 'Salon', scenes: [{ id: 'a', name: 'Film', colors: ['#f00'] }, { id: 'b', name: 'Détente', colors: ['#f80'] }] },
  { name: 'Bureau', scenes: [{ id: 'c', name: 'Veilleuse', colors: ['#f60', '#00f'] }] },
]

describe('shortcutScenes', () => {
  it('keeps the chosen order, across rooms, with the room name', () => {
    expect(shortcutScenes(rooms, ['c', 'a']).map((s) => `${s.room} · ${s.name}`)).toEqual(['Bureau · Veilleuse', 'Salon · Film'])
  })

  it('skips a scene deleted from the bridge since', () => {
    expect(shortcutScenes(rooms, ['gone', 'b']).map((s) => s.id)).toEqual(['b'])
  })

  it('gives nothing while the bridge is unknown or nothing is chosen', () => {
    expect(shortcutScenes(null, ['a'])).toEqual([])
    expect(shortcutScenes(rooms, [])).toEqual([])
  })
})

describe('sceneSwatch', () => {
  it('blends several colors, keeps a single one plain', () => {
    expect(sceneSwatch(['#f60', '#00f'])).toBe('linear-gradient(135deg, #f60, #00f)')
    expect(sceneSwatch(['#f00'])).toBe('#f00')
  })
})
