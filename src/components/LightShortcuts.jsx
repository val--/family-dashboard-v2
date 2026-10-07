import { useState } from 'react'
import { sceneSwatch, shortcutScenes } from '../lib/hue'

// A discreet row on the screensaver: the light scenes chosen in Settings, and "Tout éteindre". Dimmed
// (bright swatches would glare at night), lit up under the finger; a tap acts without waking the screen.
export default function LightShortcuts({ hue, sceneIds }) {
  const [pending, setPending] = useState(null)
  const scenes = shortcutScenes(hue?.rooms, sceneIds)
  if (scenes.length === 0) return null

  const tap = (id, action) => (event) => {
    event.stopPropagation() // the screensaver's tap would wake it
    setPending(id)
    action()
      .catch(() => {}) // the next reading of the bridge shows what really happened
      .finally(() => setPending(null))
  }

  return (
    <div className="mt-9 flex items-start justify-center gap-1">
      {scenes.map((scene) => (
        <button
          key={scene.id}
          onClick={tap(scene.id, () => hue.recallScene(scene.id))}
          aria-label={`Scénario ${scene.name} (${scene.room})`}
          className="flex w-[3.75rem] flex-col items-center gap-1.5 opacity-50 transition-opacity active:opacity-100"
        >
          <span
            className={`block h-10 w-10 rounded-full ${scene.active ? 'ring-1 ring-white ring-offset-2 ring-offset-black' : ''} ${
              pending === scene.id ? 'animate-pulse' : ''
            }`}
            style={{ background: sceneSwatch(scene.colors) }}
          />
          <span className="w-full truncate text-center text-xs leading-tight text-white/80">{scene.name}</span>
        </button>
      ))}
      {hue.home && (
        <button
          onClick={tap('home', () => hue.setRoom(hue.home.group, { on: false }))}
          aria-label="Tout éteindre"
          className={`flex w-[3.75rem] flex-col items-center gap-1.5 transition-opacity active:opacity-100 ${hue.home.on ? 'opacity-50' : 'opacity-25'}`}
        >
          <span className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/60 ${pending === 'home' ? 'animate-pulse' : ''}`}>
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.7 1 1.5 1 2.5h6c0-1 .2-1.8 1-2.5A6 6 0 0 0 12 3Z" />
              <path d="M3 3l18 18" />
            </svg>
          </span>
          <span className="w-full truncate text-center text-xs leading-tight text-white/80">Éteindre</span>
        </button>
      )}
    </div>
  )
}
