import { useState } from 'react'
import { usePrinter } from '../hooks/usePrinter'
import { useVpn } from '../hooks/useVpn'
import { useSeedbox } from '../hooks/useSeedbox'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'

const PRINTER_STATUS = {
  idle: 'Prête',
  printing: 'Impression…',
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

function formatBytes(bytes) {
  if (bytes == null) return null
  const units = [['To', 1024 ** 4], ['Go', 1024 ** 3], ['Mo', 1024 ** 2]]
  const [unit, size] = units.find(([, s]) => bytes >= s) || units[units.length - 1]
  return `${(bytes / size).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${unit}`
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec) return '0'
  if (bytesPerSec >= 1024 ** 2) return `${(bytesPerSec / 1024 ** 2).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo/s`
  return `${Math.round(bytesPerSec / 1024)} Ko/s`
}

const SEEDBOX_STATUS = {
  connected: 'Connectée',
  firewalled: 'Pare-feu',
  disconnected: 'Déconnectée',
}

// One compact row per device: title + status on the left, details on the right
function Card({ title, ok, label, children }) {
  return (
    <div className="bg-white/5 rounded-2xl px-4 py-3 flex items-center gap-4">
      <div className="shrink-0 w-40">
        <h2 className="text-xl font-light leading-tight">{title}</h2>
        <div className={`flex items-center gap-2 text-base leading-tight ${ok ? 'text-green-400' : 'text-red-400'}`}>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="truncate">{label}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function Field({ label, value, valueClassName = 'text-white' }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <div className="text-sm leading-tight text-white/40">{label}</div>
      <div className={`text-lg leading-tight truncate ${valueClassName}`}>{value}</div>
    </div>
  )
}

function VpnCard({ vpn }) {
  const location = [vpn.city, vpn.country].filter(Boolean).join(', ')

  return (
    <Card title="VPN" ok={vpn.healthy} label={vpn.healthy ? 'Connecté' : 'Déconnecté'}>
      {vpn.healthy && (
        <div className="grid grid-cols-4 gap-x-4">
          <Field label="Fournisseur" value={vpn.provider} />
          <Field label="Connecté depuis" value={formatUptime(vpn.since)} />
          <Field label="IP publique" value={vpn.ip} />
          <Field label="Localisation" value={location} />
        </div>
      )}
    </Card>
  )
}

function SeedboxCard({ seedbox }) {
  const ratio = seedbox.ratio
  const speed = seedbox.downSpeed > 0
    ? `↑ ${formatSpeed(seedbox.upSpeed)} ↓ ${formatSpeed(seedbox.downSpeed)}`
    : `↑ ${formatSpeed(seedbox.upSpeed)}`

  return (
    <Card
      title="Seedbox"
      ok={seedbox.connection === 'connected'}
      label={SEEDBOX_STATUS[seedbox.connection] || 'Inconnue'}
    >
      <div className="grid grid-cols-4 gap-x-4">
        <Field
          label="Ratio"
          value={ratio != null && ratio.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          valueClassName={ratio >= 1 ? 'text-green-400' : 'text-orange-400'}
        />
        <Field label="Envoyé" value={formatBytes(seedbox.uploaded)} />
        <Field label="Téléchargé" value={formatBytes(seedbox.downloaded)} />
        <Field label="Débit" value={speed} />
      </div>
    </Card>
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

  const info = test.message
    || (printer.jobs > 0 ? `${printer.jobs} document${printer.jobs > 1 ? 's' : ''} en attente` : '')

  return (
    <Card
      title="Imprimante"
      ok={available}
      label={PRINTER_STATUS[printer.status] || (available ? 'En ligne' : 'Hors ligne')}
    >
      <div className="flex items-center justify-end gap-4">
        {info && (
          <div className={`text-sm ${
            test.state === 'error' ? 'text-red-400' : test.state === 'done' ? 'text-green-400' : 'text-white/50'
          }`}>
            {info}
          </div>
        )}
        <button
          onClick={testPrint}
          disabled={!available || busy}
          className="px-5 py-2.5 rounded-xl text-lg bg-white/10 active:bg-white/25 disabled:opacity-30 shrink-0"
        >
          {busy ? 'Envoi…' : "Tester l'imprimante"}
        </button>
      </div>
    </Card>
  )
}

export default function Devices() {
  const { data: printer, loading: printerLoading, error: printerError, refresh } = usePrinter()
  const { data: vpn, loading: vpnLoading, error: vpnError } = useVpn()
  const { data: seedbox, loading: seedboxLoading, error: seedboxError } = useSeedbox()

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-2">
      {!vpnLoading && !vpnError && vpn && <VpnCard vpn={vpn} />}
      {!seedboxLoading && !seedboxError && seedbox && <SeedboxCard seedbox={seedbox} />}
      {!printerLoading && !printerError && printer && (
        <PrinterCard printer={printer} refresh={refresh} />
      )}
    </div>
  )
}
