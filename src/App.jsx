import Clock from './components/Clock'
import Weather from './components/Weather'
import Calendar from './components/Calendar'
import Plex from './components/Plex'
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

function App() {
  const devicesIndicator = useDevicesIndicator()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-white p-6">
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
          titles={['Agenda', 'Films', 'Appareils']}
          indicators={[null, null, devicesIndicator]}
        >
          <Calendar />
          <Plex />
          <Devices />
        </WidgetCarousel>
      </div>
    </div>
  )
}

export default App
