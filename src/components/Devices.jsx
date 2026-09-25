import { useState } from 'react'
import { usePrinter } from '../hooks/usePrinter'
import { useVpn } from '../hooks/useVpn'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'

const PRINTER_STATUS = {
  idle: 'Prête',
  printing: 'Impression en cours…',
  disabled: 'Désactivée',
  offline: 'Débranchée',
}

function formatUptime(since) {
  if (!since) return null
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days} j ${hours} h`
  if (hours > 0) return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
  return `${minutes} min`
}

function StatusBadge({ ok, label }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-1.5 rounded-full text-lg ${
        ok ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
      }`}
    >
      <span className={`w-3 h-3 rounded-full shrink-0 ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
      {label}
    </div>
  )
}

function Field({ label, value }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <div className="text-sm text-white/40">{label}</div>
      <div className="text-lg text-white truncate">{value}</div>
    </div>
  )
}

function VpnCard({ vpn }) {
  const location = [vpn.city, vpn.country].filter(Boolean).join(', ')

  return (
    <div className="bg-white/5 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-light">VPN</h2>
        <StatusBadge ok={vpn.healthy} label={vpn.healthy ? 'Connecté' : 'Déconnecté'} />
      </div>
      {vpn.healthy && (
        <div className="grid grid-cols-4 gap-x-4">
          <Field label="Fournisseur" value={vpn.provider} />
          <Field label="Connecté depuis" value={formatUptime(vpn.since)} />
          <Field label="IP publique" value={vpn.ip} />
          <Field label="Localisation" value={location} />
        </div>
      )}
    </div>
  )
}

function PrinterCard({ printer, refresh }) {
  const [test, setTest] = useState({ state: 'idle', message: '' })

  const available = printer.connected && printer.status !== 'disabled'
  const busy = test.state === 'sending'

  async function testPrint() {
    setTest({ state: 'sending', message: '' })
    try {
      const res = await fetch(`${API_URL}/api/printer/test`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Échec de l'impression")
      setTest({ state: 'done', message: 'Envoyé à l’imprimante !' })
      setTimeout(refresh, 3000)
    } catch (err) {
      setTest({ state: 'error', message: err.message })
    }
    setTimeout(() => setTest({ state: 'idle', message: '' }), 6000)
  }

  return (
    <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
      <div className="flex flex-col gap-2 min-w-0">
        <h2 className="text-2xl font-light">Imprimante</h2>
        <StatusBadge
          ok={available}
          label={PRINTER_STATUS[printer.status] || (available ? 'En ligne' : 'Hors ligne')}
        />
        {printer.jobs > 0 && (
          <div className="text-base text-white/50">
            {printer.jobs} document{printer.jobs > 1 ? 's' : ''} en attente
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <button
          onClick={testPrint}
          disabled={!available || busy}
          className="px-5 py-3 rounded-xl text-lg bg-white/10 active:bg-white/25 disabled:opacity-30"
        >
          {busy ? 'Envoi…' : "Tester l'imprimante"}
        </button>
        {test.message && (
          <div className={`text-sm ${test.state === 'error' ? 'text-red-400' : 'text-green-400'}`}>
            {test.message}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Devices() {
  const { data: printer, loading: printerLoading, error: printerError, refresh } = usePrinter()
  const { data: vpn, loading: vpnLoading, error: vpnError } = useVpn()

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-3">
      {!vpnLoading && !vpnError && vpn && <VpnCard vpn={vpn} />}
      {!printerLoading && !printerError && printer && (
        <PrinterCard printer={printer} refresh={refresh} />
      )}
    </div>
  )
}
