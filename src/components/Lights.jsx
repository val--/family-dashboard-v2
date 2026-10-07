import { useEffect, useRef, useState } from 'react'
import { useHue } from '../hooks/useHue'

const ROOM_KEY = 'hue-room'

function loadRoom() {
  try {
    return localStorage.getItem(ROOM_KEY)
  } catch {
    return null
  }
}

function saveRoom(id) {
  try {
    localStorage.setItem(ROOM_KEY, id)
  } catch {
    // private mode: the first room next time
  }
}

// A scene's palette as a round swatch: its colors in a soft diagonal blend
function swatch(colors) {
  return colors.length > 1 ? `linear-gradient(135deg, ${colors.join(', ')})` : colors[0]
}

function Switch({ on, pending, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-amber-300' : 'bg-white/15'} ${pending ? 'opacity-60' : ''}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

function SceneButton({ scene, pending, onClick }) {
  return (
    <button onClick={onClick} className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-1 active:bg-white/10">
      <span
        className={`relative block h-11 w-11 shrink-0 rounded-full ${scene.active ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
        style={{ background: swatch(scene.colors) }}
      >
        {pending && <span className="absolute inset-0 animate-pulse rounded-full bg-black/40" />}
      </span>
      <span className={`line-clamp-2 text-center text-xs leading-tight ${scene.active ? 'font-semibold text-white' : 'text-white/70'}`}>
        {scene.name}
      </span>
    </button>
  )
}

// The "Lumières" tab: pick a room, switch it or dim it, recall one of its scenes in a tap, or switch its
// lights one by one. What a tap changes shows at once; the bridge is read again right after to confirm.
export default function Lights() {
  const { rooms, loading, setLight, setRoom, recallScene } = useHue()
  const [roomId, setRoomId] = useState(loadRoom)
  const [pending, setPending] = useState({}) // id -> what the screen shows until the bridge confirms
  const [failure, setFailure] = useState(null)
  const [brightness, setBrightness] = useState(null) // while the slider is held
  const brightnessTimer = useRef(null)

  useEffect(() => {
    if (!failure) return undefined
    const timer = setTimeout(() => setFailure(null), 5000)
    return () => clearTimeout(timer)
  }, [failure])

  if (loading && !rooms) return null
  if (!rooms) {
    return <div className="flex h-full items-center justify-center text-white/60">Les lumières sont indisponibles pour le moment.</div>
  }
  if (rooms.length === 0) {
    return <div className="flex h-full items-center justify-center text-white/60">Aucune pièce sur le pont Hue.</div>
  }

  const room = rooms.find((r) => r.id === roomId) ?? rooms[0]
  const shown = (id, actual) => (id in pending ? pending[id] : actual)
  const roomOn = shown(room.group, room.on)

  // Shows `value` for `id` at once, runs the action, then lets the bridge's answer take over
  async function act(id, value, action) {
    setPending((p) => ({ ...p, [id]: value }))
    try {
      await action()
    } catch (err) {
      setFailure(err.message)
    } finally {
      setPending((p) => {
        const { [id]: _done, ...rest } = p
        return rest
      })
    }
  }

  // Dimming follows the finger, sent at most every 300 ms (the bridge doesn't like floods)
  function onBrightness(value) {
    setBrightness(value)
    clearTimeout(brightnessTimer.current)
    brightnessTimer.current = setTimeout(() => setRoom(room.group, { brightness: value }).catch((err) => setFailure(err.message)), 300)
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setRoomId(r.id)
                saveRoom(r.id)
                setBrightness(null)
              }}
              className={`rounded-full px-4 py-1.5 text-base ${r.id === room.id ? 'bg-white font-medium text-black' : 'bg-white/10 text-white/80'}`}
            >
              {r.name}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {room.group && (
            <>
              <input
                type="range"
                min="1"
                max="100"
                value={brightness ?? room.brightness ?? 1}
                disabled={!roomOn}
                onChange={(e) => onBrightness(Number(e.target.value))}
                onPointerUp={() => setTimeout(() => setBrightness(null), 1500)}
                aria-label="Luminosité de la pièce"
                className="w-36 accent-amber-300 disabled:opacity-30"
              />
              <span className="w-10 text-right text-sm tabular-nums text-white/60">{roomOn ? `${brightness ?? room.brightness}%` : ''}</span>
              <Switch
                on={roomOn}
                pending={room.group in pending}
                label={roomOn ? `Éteindre : ${room.name}` : `Allumer : ${room.name}`}
                onClick={() => act(room.group, !roomOn, () => setRoom(room.group, { on: !roomOn }))}
              />
            </>
          )}
        </div>
      </div>

      {failure && <div className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-300">{failure}</div>}

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="text-xs uppercase tracking-wider text-white/50">Scénarios</div>
          {room.scenes.length === 0 ? (
            <div className="text-sm text-white/50">Aucun scénario dans cette pièce.</div>
          ) : (
            <div className="grid grid-cols-6 gap-x-1 gap-y-0.5">
              {room.scenes.map((scene) => (
                <SceneButton
                  key={scene.id}
                  scene={scene}
                  pending={scene.id in pending}
                  onClick={() => act(scene.id, true, () => recallScene(scene.id))}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-60 shrink-0 overflow-y-auto">
          <div className="mb-1 text-xs uppercase tracking-wider text-white/50">Lumières</div>
          <div className="flex flex-col">
            {room.lights.map((light) => {
              const on = shown(light.id, light.on)
              return (
                <div key={light.id} className="flex items-center gap-3 py-1.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: on ? light.color || '#fff4e0' : 'rgba(255,255,255,0.15)' }}
                  />
                  <span className={`min-w-0 flex-1 truncate text-sm ${on ? 'text-white' : 'text-white/50'}`}>{light.name}</span>
                  <Switch
                    on={on}
                    pending={light.id in pending}
                    label={on ? `Éteindre : ${light.name}` : `Allumer : ${light.name}`}
                    onClick={() => act(light.id, !on, () => setLight(light.id, { on: !on }))}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
