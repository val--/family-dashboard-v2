import { createPortal } from 'react-dom'

const IDLE_CHOICES = [
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 60, label: '1 h' },
  { value: 0, label: 'Jamais' },
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

// Full-screen Settings, opened from the gear in the header. More sections will come.
export default function Settings({ settings, onChange, error, overridden, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between pl-6 pr-2 pt-2">
        <h1 className="text-2xl font-light text-white">Paramètres</h1>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="flex h-12 w-12 items-center justify-center text-3xl leading-none text-white/70 hover:text-white"
        >
          &times;
        </button>
      </div>
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
          {error && <p className="rounded-xl bg-red-500/15 px-4 py-2 text-sm text-red-300">{error}</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
