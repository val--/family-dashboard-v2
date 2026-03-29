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
      {titles[active] && (
        <div className="text-sm uppercase tracking-wider text-white/40 mb-3">
          {titles[active]}
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {items[active]}
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
