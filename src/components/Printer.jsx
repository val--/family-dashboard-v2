import { usePrinter } from '../hooks/usePrinter'

export default function Printer() {
  const { data, loading, error } = usePrinter()

  if (error || loading || !data) return null

  const isOnline = data.connected && data.status !== 'disabled'

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}
      />
      <span className="text-sm text-white/70">Imprimante</span>
    </div>
  )
}
