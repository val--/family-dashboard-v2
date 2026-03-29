import { useState, useRef, Children } from 'react'

export default function WidgetCarousel({ children, titles = [] }) {
  const [active, setActive] = useState(0)
  const touchStart = useRef(null)
  const items = Children.toArray(children)
  const count = items.length

  function onTouchStart(e) {
    touchStart.current = e.touches[0].clientX
  }

  function onTouchEnd(e) {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    const threshold = 50
    if (diff > threshold && active < count - 1) {
      setActive(active + 1)
    } else if (diff < -threshold && active > 0) {
      setActive(active - 1)
    }
    touchStart.current = null
  }

  return (
    <div
      className="flex flex-col h-full"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {count > 1 && (
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => setActive((active - 1 + count) % count)}
            className="text-white/40 hover:text-white/70 text-4xl w-12 h-12 flex items-center justify-center"
          >
            &#8249;
          </button>
          <span className="text-lg uppercase tracking-wider text-white/40 w-24 text-center">
            {titles[active] || ''}
          </span>
          <button
            onClick={() => setActive((active + 1) % count)}
            className="text-white/40 hover:text-white/70 text-4xl w-12 h-12 flex items-center justify-center"
          >
            &#8250;
          </button>
        </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        {items.map((item, i) => (
          <div key={i} className={`h-full ${i === active ? '' : 'hidden'}`}>
            {item}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="flex justify-center gap-1.5 pt-3">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === active ? 'bg-white/60' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
