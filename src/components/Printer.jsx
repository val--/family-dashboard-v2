import { usePrinter } from '../hooks/usePrinter'

const STATUS_LABELS = {
  idle: 'Prête',
  printing: 'Impression…',
  disabled: 'Désactivée',
  offline: 'Hors ligne',
  unknown: 'Inconnu',
}

function InkBar({ name, level, color }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/50 w-16 text-right">{name}</span>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${level}%`,
            backgroundColor: color || '#fff',
          }}
        />
      </div>
      <span className="text-xs text-white/50 w-8">{level}%</span>
    </div>
  )
}

export default function Printer() {
  const { data, loading, error } = usePrinter()

  if (error || loading || !data) return null

  const statusLabel = STATUS_LABELS[data.status] || data.status
  const isOnline = data.connected && data.status !== 'disabled'

  return (
    <div className="flex flex-col items-center gap-3 w-64">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}
        />
        <span className="text-sm text-white/70">
          Imprimante — {statusLabel}
        </span>
      </div>

      {data.ink && (
        <div className="w-full flex flex-col gap-2">
          {data.ink.map((cartridge) => (
            <InkBar key={cartridge.name} {...cartridge} />
          ))}
        </div>
      )}
    </div>
  )
}
