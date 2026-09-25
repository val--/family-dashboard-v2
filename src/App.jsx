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
import { useWeather } from './hooks/useWeather'
import { useIdle } from './hooks/useIdle'
import Screensaver from './components/Screensaver'

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

// Screensaver after 5 minutes without touch; ?idle=<seconds> overrides it (handy to preview)
const IDLE_SECONDS = Number(new URLSearchParams(window.location.search).get('idle')) || 5 * 60

function App() {
  const devicesIndicator = useDevicesIndicator()
  const weather = useWeather()
  const { idle, wake, sleep } = useIdle(IDLE_SECONDS * 1000)

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-black text-white px-4 pt-3 pb-2"
      style={{ visibility: idle ? 'hidden' : 'visible' }} // hidden = not painted, animations sleep
    >
      {/* Top: Clock left half, Weather right half */}
      <div className="flex items-center">
        <div className="flex-1 flex justify-center">
          <Clock />
        </div>
        <div className="flex-1 flex justify-center">
          <Weather weather={weather} />
        </div>
        <button
          onClick={sleep}
          aria-label="Mise en veille"
          className="shrink-0 -mr-2 w-10 h-10 flex items-center justify-center text-white/40 active:text-white"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        </button>
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

      {idle && <Screensaver weather={weather} onWake={wake} />}
    </div>
  )
}

export default App
