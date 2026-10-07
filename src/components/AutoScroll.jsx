import { useEffect, useRef, useState } from 'react'

const SPEED = 18 // px per second: slow enough to read along
const HOLD = 0.12 // share of each way spent still, at the top and at the bottom

// A box that slowly scrolls its content up and back down when it doesn't fit (and stays still when it
// does): a pause to start reading, a slow scroll, a pause at the end. A CSS animation (light on the Pi);
// the sizes are watched, so a font loading late or a new text are followed.
export default function AutoScroll({ children, className = '' }) {
  const box = useRef(null)
  const content = useRef(null)
  const [overflow, setOverflow] = useState(0)

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined // tests: no layout
    const observer = new ResizeObserver(() => {
      if (box.current && content.current) setOverflow(Math.max(0, content.current.scrollHeight - box.current.clientHeight))
    })
    observer.observe(box.current)
    observer.observe(content.current)
    return () => observer.disconnect()
  }, [])

  const seconds = overflow / SPEED / (1 - 2 * HOLD)
  return (
    <div ref={box} className={`overflow-hidden ${className}`}>
      <div
        ref={content}
        className={overflow > 4 ? 'animate-autoscroll' : ''}
        style={overflow > 4 ? { '--scroll-distance': `-${overflow}px`, animationDuration: `${seconds}s` } : undefined}
      >
        {children}
      </div>
    </div>
  )
}
