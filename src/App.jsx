import { useState } from 'react'
import Clock from './components/Clock'
import Weather from './components/Weather'
import Calendar from './components/Calendar'
import PostIts from './components/PostIts'
import Plex from './components/Plex'
import Shows from './components/Shows'
import Devices from './components/Devices'
import Lights from './components/Lights'
import WidgetCarousel from './components/WidgetCarousel'
import { useVpn } from './hooks/useVpn'
import { usePrinter } from './hooks/usePrinter'
import { useWeather } from './hooks/useWeather'
import { useIdle } from './hooks/useIdle'
import { useCalendar } from './hooks/useCalendar'
import { useSettings } from './hooks/useSettings'
import Settings from './components/Settings'
import ErrorBoundary from './components/ErrorBoundary'
import { useAutoReload } from './hooks/useAutoReload'
import { usePostits, useUnseenPostits } from './hooks/usePostits'
import { useStickerViews } from './hooks/useStickerViews'
import { usePlex } from './hooks/usePlex'
import { usePlexNewEpisodes } from './hooks/usePlexNewEpisodes'
import { usePlexLastWatched } from './hooks/usePlexLastWatched'
import { useHue } from './hooks/useHue'
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

// Screensaver delay comes from the Settings screen; ?idle=<seconds> overrides it (handy to preview)
const IDLE_OVERRIDE_SECONDS = Number(new URLSearchParams(window.location.search).get('idle')) || null

function App() {
  const devicesIndicator = useDevicesIndicator()
  const weather = useWeather()
  const { settings, update: updateSettings, error: settingsError } = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  const idleMs = IDLE_OVERRIDE_SECONDS ? IDLE_OVERRIDE_SECONDS * 1000 : settings.idleMinutes * 60 * 1000 // 0 = never
  const { idle, wake, sleep } = useIdle(idleMs)
  useAutoReload(idle)
  const calendar = useCalendar() // for the screensaver's look at today / tomorrow
  const postits = usePostits()
  const stickerViews = useStickerViews()
  const plex = usePlex() // the Films tab and the screensaver's latest movies
  const newEpisodes = usePlexNewEpisodes() // the screensaver's new episodes of started shows
  const lastWatched = usePlexLastWatched() // and the last movie watched, with its anecdotes
  const hue = useHue() // the Lumières tab, the screensaver's shortcuts and their settings
  const [activeTab, setActiveTab] = useState('')
  // From the screensaver: { title } = the tab to wake up on, plus what to open there (note, qr or movie)
  const [wakeRequest, setWakeRequest] = useState(null)
  const [reselected, setReselected] = useState(null) // { title } when the active tab is tapped again

  function wakeOn(request) {
    wake()
    setWakeRequest(request)
  }
  const hasNewPostit = useUnseenPostits(postits.notes, postits.config !== null, activeTab === 'Post-it' && !idle)

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-black text-white px-4 pt-3 pb-3"
      style={{ visibility: idle ? 'hidden' : 'visible' }} // hidden = not painted, animations sleep
    >
      {/* Header: clock left, weather and system buttons right */}
      <header className="flex items-center justify-between gap-6">
        <ErrorBoundary name="horloge" fallback={null}>
          <Clock />
        </ErrorBoundary>
        <div className="flex items-center gap-4">
          <ErrorBoundary name="météo" fallback={null}>
            <Weather weather={weather} />
          </ErrorBoundary>
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
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Paramètres"
              className="w-10 h-10 flex items-center justify-center text-white/50 active:text-white"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
          titles={['Agenda', 'Post-it', 'Lumières', 'Films', 'Séries', 'Appareils']}
          indicators={[null, hasNewPostit ? 'sky' : null, null, null, null, devicesIndicator]}
          onActiveChange={setActiveTab}
          goTo={wakeRequest}
          onReselect={(title) => setReselected({ title })}
        >
          <Calendar />
          <PostIts postits={postits} openRequest={wakeRequest} stickerViews={stickerViews} backToStart={reselected?.title === 'Post-it' ? reselected : null} active={activeTab === 'Post-it' && !idle} />
          <Lights hue={hue} />
          <Plex plex={plex} openRequest={wakeRequest} backToStart={reselected?.title === 'Films' ? reselected : null} />
          <Shows backToStart={reselected?.title === 'Séries' ? reselected : null} />
          <Devices />
        </WidgetCarousel>
      </div>

      {showSettings && (
        <ErrorBoundary name="paramètres" fallback={null}>
        <Settings
          settings={settings}
          hue={hue}
          onChange={updateSettings}
          error={settingsError}
          overridden={Boolean(IDLE_OVERRIDE_SECONDS)}
          onClose={() => setShowSettings(false)}
        />
        </ErrorBoundary>
      )}
      {idle && (
        // if the screensaver itself fails: a black screen that still wakes up on touch
        <ErrorBoundary name="écran de veille" fallback={<div onClick={wake} className="visible fixed inset-0 z-[100] bg-black" />}>
          <Screensaver
            weather={weather}
            events={calendar.events}
            notes={postits.notes}
            movies={plex.movies}
            episodes={newEpisodes}
            watchedMovie={lastWatched}
            hasNew={hasNewPostit}
            onWake={wake}
            onOpenNote={(note) => wakeOn({ title: 'Post-it', note })}
            onAddNote={() => wakeOn({ title: 'Post-it', qr: true })}
            onOpenMovie={(movie) => wakeOn({ title: 'Films', movie })}
            onOpenEpisode={() => wakeOn({ title: 'Séries' })}
            onOpenWatched={() => wakeOn({ title: 'Films', trivia: true })}
            stickerViews={stickerViews}
            postitSeconds={settings.postitSeconds}
            postitRange={settings.postitRange}
            movieDays={settings.movieDays}
            episodeDays={settings.episodeDays}
            watchedDays={settings.watchedDays}
            hue={hue}
            lightShortcuts={settings.lightShortcuts}
          />
        </ErrorBoundary>
      )}
    </div>
  )
}

export default App
