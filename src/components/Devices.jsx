import { useState } from 'react'
import { usePrinter } from '../hooks/usePrinter'
import { useVpn } from '../hooks/useVpn'
import { useSystem } from '../hooks/useSystem'

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
  const units = [['To', 1024 ** 4], ['Go', 1024 ** 3], ['Mo', 1024 ** 2]]
  const [unit, size] = units.find(([, s]) => bytes >= s) || units[units.length - 1]
  return `${(bytes / size).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${unit}`
}

function formatRate(bytesPerSec) {
  if (bytesPerSec >= 1024 ** 2) return `${(bytesPerSec / 1024 ** 2).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo/s`
  return `${Math.round(bytesPerSec / 1024)} Ko/s`
}

function formatDays(seconds) {
  const days = Math.floor(seconds / 86400)
  return days > 0 ? `${days} j` : `${Math.floor(seconds / 3600)} h`
}

const LEVELS = {
  ok: { text: 'text-white', bar: 'bg-white/60' },
  warn: { text: 'text-orange-400', bar: 'bg-orange-400' },
  alert: { text: 'text-red-400', bar: 'bg-red-400' },
}

// Orange from `warn`, red from `alert`
function level(value, warn, alert) {
  if (value >= alert) return LEVELS.alert
  if (value >= warn) return LEVELS.warn
  return LEVELS.ok
}

// Neutral cards; the only color is a tint on each card's icon
const ICON_COLORS = { sky: 'text-sky-300', purple: 'text-purple-300', teal: 'text-teal-300' }

const ICON_PROPS = {
  className: 'w-5 h-5 shrink-0',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function ShieldIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function PrinterIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  )
}

// Simplified Ubuntu "circle of friends": three dots on a ring, on an orange disc
function UbuntuIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="#E95420" />
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff" strokeWidth="1.8" />
      {[[5.5, 12], [15.25, 6.4], [15.25, 17.6]].map(([x, y]) => (
        <circle key={x + '-' + y} cx={x} cy={y} r="2.4" fill="#fff" stroke="#E95420" strokeWidth="1.3" />
      ))}
    </svg>
  )
}

// One compact row per device: icon + title + status on the left, details on the right
function Card({ accent, icon, title, ok, label, children }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 flex items-center gap-4">
      {/* Icon column: the icon on the title row, the status dot centered under it,
          so the title and the status text start at the same x */}
      <div className="shrink-0 w-36 grid grid-cols-[1.25rem_1fr] items-center gap-x-2 gap-y-0.5">
        <span className={ICON_COLORS[accent]}>{icon}</span>
        <h2 className="text-lg font-light leading-tight truncate">{title}</h2>
        <span className={`justify-self-center w-2 h-2 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className={`text-sm leading-tight truncate ${ok ? 'text-green-400' : 'text-red-400'}`}>{label}</span>
      </div>
      <div className="flex-1 min-w-0 border-l border-white/10 pl-4">{children}</div>
    </div>
  )
}

function Bar({ percent, level: { bar } }) {
  return (
    <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  )
}

function Field({ label, value, valueClassName = 'text-white', className = '', children }) {
  if (!value) return null
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-sm leading-tight text-white/60 truncate">{label}</div>
      <div className={`text-lg leading-tight truncate ${valueClassName}`}>{value}</div>
      {children}
    </div>
  )
}

function VpnCard({ vpn }) {
  const location = [vpn.city, vpn.country].filter(Boolean).join(', ')

  return (
    <Card accent="sky" icon={<ShieldIcon />} title="VPN" ok={vpn.healthy} label={vpn.healthy ? 'Connecté' : 'Déconnecté'}>
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

function ServerCard({ system }) {
  const { cpu, memory, temperature, network, disks } = system
  const usedPercent = (disk) => (100 * (disk.total - disk.free)) / disk.total
  const ok =
    cpu < 90 && memory.percent < 90 && !(temperature >= 80) && disks.every((disk) => usedPercent(disk) < 90)

  const cpuLevel = level(cpu, 70, 90)
  const memLevel = level(memory.percent, 75, 90)
  const tempLevel = level(temperature, 70, 80)

  return (
    <Card
      accent="purple"
      icon={<UbuntuIcon />}
      title="Serveur"
      ok={ok}
      label={ok ? `Actif ${formatDays(system.uptime)}` : 'Attention'}
    >
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-5 gap-x-4">
          <Field label="CPU" value={`${Math.round(cpu)} %`} valueClassName={cpuLevel.text}>
            <Bar percent={cpu} level={cpuLevel} />
          </Field>
          <Field label={`RAM (${formatBytes(memory.total)})`} value={formatBytes(memory.used)} valueClassName={memLevel.text}>
            <Bar percent={memory.percent} level={memLevel} />
          </Field>
          <Field
            label="Température"
            value={temperature != null && `${temperature} °C`}
            valueClassName={tempLevel.text}
          />
          <Field
            label="Réseau"
            className="col-span-2"
            value={
              network && (
                <>
                  <span className="text-sky-400">↓</span> {formatRate(network.down)}{' '}
                  <span className="text-orange-400">↑</span> {formatRate(network.up)}
                </>
              )
            }
          />
        </div>
        <div className="grid grid-flow-col auto-cols-fr gap-x-4">
          {disks.map((disk) => {
            const diskLevel = level(usedPercent(disk), 85, 95)
            return (
              <Field
                key={disk.name}
                label={disk.name}
                value={`${formatBytes(disk.free)} libres`}
                valueClassName={diskLevel.text}
              >
                <Bar percent={usedPercent(disk)} level={diskLevel} />
              </Field>
            )
          })}
        </div>
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
      accent="teal"
      icon={<PrinterIcon />}
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
  const { data: system, loading: systemLoading, error: systemError } = useSystem()

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-4">
      {!vpnLoading && !vpnError && vpn && <VpnCard vpn={vpn} />}
      {!systemLoading && !systemError && system && <ServerCard system={system} />}
      {!printerLoading && !printerError && printer && (
        <PrinterCard printer={printer} refresh={refresh} />
      )}
    </div>
  )
}
