import { useState, useRef, Children } from 'react'

const plain = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// ?tab=appareils opens that tab first (handy for screenshots and bookmarks)
function initialTab(titles) {
  const wanted = new URLSearchParams(window.location.search).get('tab')
  const index = wanted ? titles.findIndex((title) => plain(title) === plain(wanted)) : -1
  return index >= 0 ? index : 0
}

export default function WidgetCarousel({ children, titles = [], indicators = [] }) {
  const [active, setActive] = useState(() => initialTab(titles))
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
        <div className="flex items-center justify-center gap-8 mb-3">
          {titles.map((title, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`relative py-1.5 text-lg border-b-2 ${
                i === active ? 'text-white border-sky-400' : 'text-white/60 border-transparent'
              }`}
            >
              {title}
              {indicators[i] && (
                <span
                  className={`absolute top-0 -right-3 w-2.5 h-2.5 rounded-full ${
                    indicators[i] === 'green' ? 'bg-green-400' :
                    indicators[i] === 'orange' ? 'bg-orange-400' :
                    indicators[i] === 'red' ? 'bg-red-400' : ''
                  }`}
                />
              )}
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
            <div
              key={i}
              className={`w-full shrink-0 h-full ${i === active ? '' : '[&_*]:[animation-play-state:paused]'}`}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
