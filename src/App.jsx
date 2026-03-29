import Clock from './components/Clock'
import Weather from './components/Weather'
import Printer from './components/Printer'
import Calendar from './components/Calendar'
import Plex from './components/Plex'

function App() {
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

      {/* Middle: Calendar left half, CTAs right half */}
      <div className="flex-1 flex items-start pt-8 gap-8">
        <div className="w-1/2">
          <Calendar />
        </div>
        <div className="w-1/2 overflow-hidden">
          <Plex />
        </div>
      </div>

      {/* Bottom: Printer status */}
      <div className="flex justify-center pb-2">
        <Printer />
      </div>
    </div>
  )
}

export default App
