import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import PostitNote from './Note'

afterEach(cleanup)

const base = { id: 1, author: 'Alice', text: 'Coucou', color: 'yellow', createdAt: 1790000000 }

describe('PostitNote', () => {
  it('shows a photo note with its picture', () => {
    const { container } = render(<PostitNote note={{ ...base, photo: 'a'.repeat(32), photoRatio: 1.33 }} size="lg" />)
    expect(container.querySelector('img').src).toMatch(/aaaa_thumb\.jpg$/)
    expect(container.querySelector('video')).toBeNull()
  })

  it('plays a video note, muted and in a loop, with its poster', () => {
    const { container } = render(<PostitNote note={{ ...base, photo: 'b'.repeat(32), photoRatio: 0.56, video: true }} size="lg" />)
    const video = container.querySelector('video')
    expect(video.src).toMatch(/bbbb\.mp4$/)
    expect(video.poster).toMatch(/bbbb_thumb\.jpg$/)
    expect(video.muted).toBe(true)
    expect(video.loop).toBe(true)
  })

  it("shows only the video's poster when it must not play (off screen)", () => {
    const { container } = render(<PostitNote note={{ ...base, photo: 'c'.repeat(32), video: true }} size="md" playVideo={false} />)
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('img').src).toMatch(/cccc_thumb\.jpg$/)
  })

  it("previews the phone's still before the upload, never the video", () => {
    const { container } = render(<PostitNote note={{ ...base, video: true }} size="lg" photoSrc="blob:still" />)
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('img').getAttribute('src')).toBe('blob:still')
  })

  it('signs with the author, and the age when asked', () => {
    const { container, rerender } = render(<PostitNote note={base} />)
    expect(container.textContent).toContain('— Alice')
    expect(container.textContent).not.toContain('·')
    rerender(<PostitNote note={base} showDate />)
    expect(container.textContent).toMatch(/— Alice · /)
  })
})
