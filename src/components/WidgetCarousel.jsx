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
        <div className="flex items-center justify-center gap-6 mb-4">
          {titles.map((title, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`text-lg uppercase tracking-wider ${
                i === active ? 'text-white' : 'text-white/30'
              }`}
            >
              {title}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-300 ease-out will-change-transform"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {items.map((item, i) => (
            <div key={i} className="w-full shrink-0 h-full">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
