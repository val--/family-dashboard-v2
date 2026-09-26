import { useState } from 'react'
import Clock from './components/Clock'
import Weather from './components/Weather'
import Calendar from './components/Calendar'
import PostIts from './components/PostIts'
import Plex from './components/Plex'
import Shows from './components/Shows'
import Sorties from './components/Sorties'
import Devices from './components/Devices'
import WidgetCarousel from './components/WidgetCarousel'
import { useVpn } from './hooks/useVpn'
import { usePrinter } from './hooks/usePrinter'
import { useWeather } from './hooks/useWeather'
import { useIdle } from './hooks/useIdle'
import { usePostits, useUnseenPostits } from './hooks/usePostits'
import { useStickerViews } from './hooks/useStickerViews'
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
  const postits = usePostits()
  const stickerViews = useStickerViews()
  const [activeTab, setActiveTab] = useState('')
  const [postitRequest, setPostitRequest] = useState(null)

  function openPostitFromScreensaver(note) {
    wake()
    setPostitRequest({ title: 'Post-it', note })
  }
  const hasNewPostit = useUnseenPostits(postits.notes, postits.config !== null, activeTab === 'Post-it' && !idle)

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-black text-white px-4 pt-3 pb-3"
      style={{ visibility: idle ? 'hidden' : 'visible' }} // hidden = not painted, animations sleep
    >
      {/* Header: clock left, weather and system buttons right */}
      <header className="flex items-center justify-between gap-6">
        <Clock />
        <div className="flex items-center gap-4">
          <Weather weather={weather} />
          <div className="flex items-center -mr-2">
            <button
              onClick={sleep}
              aria-label="Mise en veille"
              className="w-10 h-10 flex items-center justify-center text-white/50 active:text-white"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            </button>
            {/* Full reload: picks up new builds and frees browser memory */}
            <button
              onClick={() => window.location.reload()}
              aria-label="Rafraîchir"
              className="w-10 h-10 flex items-center justify-center text-white/50 active:text-white"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Swipeable widgets */}
      <div className="flex-1 overflow-hidden pt-4">
        <WidgetCarousel
          titles={['Agenda', 'Post-it', ...(SHOW_SORTIES ? ['Sorties'] : []), 'Films', 'Séries', 'Appareils']}
          indicators={[null, hasNewPostit ? 'sky' : null, ...(SHOW_SORTIES ? [null] : []), null, null, devicesIndicator]}
          onActiveChange={setActiveTab}
          goTo={postitRequest}
        >
          <Calendar />
          <PostIts postits={postits} openRequest={postitRequest} stickerViews={stickerViews} />
          {SHOW_SORTIES && <Sorties />}
          <Plex />
          <Shows />
          <Devices />
        </WidgetCarousel>
      </div>

      {idle && <Screensaver weather={weather} notes={postits.notes} hasNew={hasNewPostit} onWake={wake} onOpenNote={openPostitFromScreensaver} stickerViews={stickerViews} />}
    </div>
  )
}

export default App
