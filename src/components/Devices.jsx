import { usePrinter } from '../hooks/usePrinter'
import { useVpn } from '../hooks/useVpn'

function DeviceRow({ name, isOnline, detail }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}
      />
      <span className="text-base text-white/70">{name}</span>
      <span className="text-sm text-white/30">
        {detail || (isOnline ? 'En ligne' : 'Hors ligne')}
      </span>
    </div>
  )
}

export default function Devices() {
  const { data: printer, loading: printerLoading, error: printerError } = usePrinter()
  const { data: vpn, loading: vpnLoading, error: vpnError } = useVpn()

  const printerOnline = printer?.connected && printer?.status !== 'disabled'

  return (
    <div className="flex flex-col gap-4">
      {(!vpnLoading && !vpnError && vpn) && (
        <DeviceRow
          name="VPN (NordVPN)"
          isOnline={vpn.healthy}
          detail={
            vpn.healthy
              ? `${vpn.ip} — ${vpn.city}, ${vpn.country}`
              : 'Déconnecté'
          }
        />
      )}
      {(!printerLoading && !printerError && printer) && (
        <DeviceRow name="Imprimante" isOnline={printerOnline} />
      )}
    </div>
  )
}
