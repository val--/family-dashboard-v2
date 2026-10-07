import FullScreen from './FullScreen'
import { sceneSwatch } from '../lib/hue'

const IDLE_CHOICES = [
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 60, label: '1 h' },
  { value: 0, label: 'Jamais' },
]

const POSTIT_SECONDS_CHOICES = [
  { value: 15, label: '15 s' },
  { value: 30, label: '30 s' },
  { value: 60, label: '1 min' },
  { value: 300, label: '5 min' },
  { value: 0, label: 'Toujours' },
]

const POSTIT_RANGE_CHOICES = [
  { value: 'today', label: "Du jour" },
  { value: '3days', label: '3 derniers jours' },
  { value: 'all', label: 'Tous' },
]

const MOVIE_DAYS_CHOICES = [
  { value: 1, label: '24 h' },
  { value: 3, label: '3 jours' },
  { value: 7, label: '7 jours' },
  { value: 14, label: '14 jours' },
  { value: 0, label: 'Non' },
]

function Choice({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`min-w-20 rounded-xl px-4 py-3 text-lg ${
            value === option.value ? 'bg-sky-400 font-medium text-black' : 'bg-white/10 text-white active:bg-white/20'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Section({ title, hint, children }) {
  return (
    <section className="rounded-2xl bg-white/10 px-5 py-4">
      <h2 className="text-lg text-white">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-white/60">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

const MAX_LIGHT_SHORTCUTS = 3

// The Hue scenes of every room, to pick up to 3 for the screensaver (in the order they are picked)
function LightShortcutsChoice({ rooms, value, onChange }) {
  const full = value.length >= MAX_LIGHT_SHORTCUTS
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  return (
    <div className="flex flex-col gap-3">
      {rooms.map((room) => (
        <div key={room.id}>
          <div className="mb-1.5 text-sm text-white/60">{room.name}</div>
          <div className="flex flex-wrap gap-2">
            {room.scenes.map((scene) => {
              const chosen = value.includes(scene.id)
              return (
                <button
                  key={scene.id}
                  onClick={() => toggle(scene.id)}
                  disabled={!chosen && full}
                  aria-pressed={chosen}
                  className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm disabled:opacity-30 ${
                    chosen ? 'bg-sky-400 font-medium text-black' : 'bg-white/10 text-white active:bg-white/20'
                  }`}
                >
                  <span className="h-6 w-6 shrink-0 rounded-full" style={{ background: sceneSwatch(scene.colors) }} />
                  {scene.name}
                  {chosen && <span className="text-xs">{value.indexOf(scene.id) + 1}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// Full-screen Settings, opened from the gear in the header. More sections will come.
export default function Settings({ settings, hue, onChange, error, overridden, onClose }) {
  return (
    <FullScreen title="Paramètres" heading onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Section
            title="Mise en veille"
            hint={
              overridden
                ? "Remplacé pour l'instant par ?idle= dans l'adresse de la page."
                : "Délai sans toucher l'écran avant l'affichage de l'écran de veille."
            }
          >
            <Choice options={IDLE_CHOICES} value={settings.idleMinutes} onChange={(idleMinutes) => onChange({ idleMinutes })} />
          </Section>
          <Section title="Post-it sur l'écran de veille">
            <div className="text-sm text-white/60">
              {settings.postitSeconds === 0
                ? "Toujours : le post-it reste affiché, on change avec les flèches (un nouveau post-it s'affiche quand même)."
                : "Durée d'affichage de chaque post-it (le dernier posté reste deux fois plus longtemps)."}
            </div>
            <div className="mt-2">
              <Choice options={POSTIT_SECONDS_CHOICES} value={settings.postitSeconds} onChange={(postitSeconds) => onChange({ postitSeconds })} />
            </div>
            <div className="mt-4 text-sm text-white/60">Post-it qui défilent</div>
            <div className="mt-2">
              <Choice options={POSTIT_RANGE_CHOICES} value={settings.postitRange} onChange={(postitRange) => onChange({ postitRange })} />
            </div>
            <div className="mt-2 text-xs text-white/45">
              {settings.postitRange === 'today'
                ? "Ceux d'aujourd'hui, sinon ceux d'hier."
                : settings.postitRange === '3days'
                  ? "Ceux d'aujourd'hui et des deux jours précédents."
                  : 'Tous les post-it du mur.'}
            </div>
          </Section>
          <Section
            title="Nouveaux films sur l'écran de veille"
            hint={
              settings.movieDays === 0
                ? "Les films ajoutés sur Plex ne sont pas montrés sur l'écran de veille."
                : 'Les films ajoutés sur Plex depuis ce délai défilent après les post-it (même durée par affiche).'
            }
          >
            <Choice options={MOVIE_DAYS_CHOICES} value={settings.movieDays} onChange={(movieDays) => onChange({ movieDays })} />
          </Section>
          <Section
            title="Raccourcis lumières sur l'écran de veille"
            hint={`Jusqu'à ${MAX_LIGHT_SHORTCUTS} scénarios, affichés discrètement avec « Tout éteindre » ; un toucher les active sans réveiller l'écran.`}
          >
            {hue?.rooms ? (
              <LightShortcutsChoice
                rooms={hue.rooms}
                value={settings.lightShortcuts}
                onChange={(lightShortcuts) => onChange({ lightShortcuts })}
              />
            ) : (
              <p className="text-sm text-white/50">Le pont Hue ne répond pas pour le moment.</p>
            )}
          </Section>
          {error && <p className="rounded-xl bg-red-500/15 px-4 py-2 text-sm text-red-300">{error}</p>}
        </div>
      </div>
    </FullScreen>
  )
}
