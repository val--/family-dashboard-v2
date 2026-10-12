import { describe, expect, it } from 'vitest'
import { videosCanPlay } from './videos'

const video = { video: true }
const photo = { photo: 'x', video: false }

describe('videosCanPlay', () => {
  it('lets up to 2 videos of a page play', () => {
    expect(videosCanPlay([video, video, photo, photo])).toBe(true)
    expect(videosCanPlay([photo])).toBe(true)
  })

  it('plays none past 2', () => {
    expect(videosCanPlay([video, video, video, photo])).toBe(false)
  })
})
