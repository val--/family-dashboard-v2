import { usePrinter } from '../hooks/usePrinter'

function DeviceRow({ name, isOnline }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}
      />
      <span className="text-base text-white/70">{name}</span>
      <span className="text-sm text-white/30">
        {isOnline ? 'En ligne' : 'Hors ligne'}
      </span>
    </div>
  )
}

export default function Devices() {
  const { data: printer, loading, error } = usePrinter()

  const printerOnline = printer?.connected && printer?.status !== 'disabled'

  return (
    <div className="flex flex-col gap-3">
      {(!loading && !error && printer) && (
        <DeviceRow name="Imprimante" isOnline={printerOnline} />
      )}
    </div>
  )
}
