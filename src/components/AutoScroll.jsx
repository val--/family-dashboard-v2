import { useEffect, useRef, useState } from 'react'

const SPEED = 15 // px per second: slow enough to read along
const GAP = 28 // px between the end of the text and its repeat
const MIN_OVERFLOW = 12 // less than a line hidden: not worth moving
// While rolling, lines fade in at the bottom and out at the top instead of being cut sharp
const FADE = 'linear-gradient(transparent, black 14px, black calc(100% - 18px), transparent)'

// A box whose content, when it doesn't fit, rolls up continuously like end credits: the text is followed
// by a copy of itself, so the loop never jumps nor goes back (a back and forth caught the eye). Still when
// everything fits. A CSS animation (light on the Pi); the sizes are watched, so a font loading late or a
// new text are followed.
export default function AutoScroll({ children, className = '' }) {
  const box = useRef(null)
  const first = useRef(null)
  const [sizes, setSizes] = useState({ box: 0, content: 0 })

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined // tests: no layout
    const observer = new ResizeObserver(() => {
      if (box.current && first.current) setSizes({ box: box.current.clientHeight, content: first.current.offsetHeight })
    })
    observer.observe(box.current)
    observer.observe(first.current)
    return () => observer.disconnect()
  }, [])

  const rolls = sizes.content - sizes.box > MIN_OVERFLOW
  const cycle = sizes.content + GAP // one copy and the gap: after that, the picture is the same as at the start
  return (
    <div ref={box} className={`overflow-hidden ${className}`} style={rolls ? { maskImage: FADE, WebkitMaskImage: FADE } : undefined}>
      <div
        className={rolls ? 'animate-autoscroll' : ''}
        style={rolls ? { '--scroll-distance': `-${cycle}px`, animationDuration: `${cycle / SPEED}s` } : undefined}
      >
        <div ref={first}>{children}</div>
        {rolls && (
          <div aria-hidden="true" style={{ paddingTop: GAP }}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
