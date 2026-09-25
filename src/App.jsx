import Clock from './components/Clock'
import Weather from './components/Weather'
import Calendar from './components/Calendar'
import Plex from './components/Plex'
import Shows from './components/Shows'
import Sorties from './components/Sorties'
import Devices from './components/Devices'
import WidgetCarousel from './components/WidgetCarousel'
import { useVpn } from './hooks/useVpn'
import { usePrinter } from './hooks/usePrinter'

function useDevicesIndicator() {
  const { data: vpn, loading: vpnLoading, error: vpnError } = useVpn()
  const { data: printer, loading: printerLoading, error: printerError } = usePrinter()

  if (vpnLoading || printerLoading) return null

  const vpnOk = vpn && !vpnError && vpn.healthy
  const printerOk = printer && !printerError && printer.connected && printer.status !== 'disabled'

  if (vpnOk && printerOk) return 'green'
  if (!vpnOk && !printerOk) return 'red'
  return 'orange'
}

// Sorties widget is hidden for now; flip to true to bring it back
const SHOW_SORTIES = false

function App() {
  const devicesIndicator = useDevicesIndicator()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-white px-4 pt-3 pb-2">
      {/* Top: Clock left half, Weather right half */}
      <div className="flex items-center">
        <div className="flex-1 flex justify-center">
          <Clock />
        </div>
        <div className="flex-1 flex justify-center">
          <Weather />
        </div>
      </div>

      {/* Swipeable widgets */}
      <div className="flex-1 overflow-hidden pt-4">
        <WidgetCarousel
          titles={['Agenda', ...(SHOW_SORTIES ? ['Sorties'] : []), 'Films', 'Séries', 'Appareils']}
          indicators={[null, ...(SHOW_SORTIES ? [null] : []), null, null, devicesIndicator]}
        >
          <Calendar />
          {SHOW_SORTIES && <Sorties />}
          <Plex />
          <Shows />
          <Devices />
        </WidgetCarousel>
      </div>

      {/* Discreet full reload for the kiosk (picks up new builds, frees browser memory) */}
      <button
        onClick={() => window.location.reload()}
        aria-label="Rafraîchir"
        className="fixed bottom-0 right-0 w-12 h-12 flex items-center justify-center text-white/15 active:text-white/60"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </div>
  )
}

export default App
