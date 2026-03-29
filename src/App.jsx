import Clock from './components/Clock'
import Weather from './components/Weather'
import Printer from './components/Printer'
import Calendar from './components/Calendar'

function App() {
  return (
    <div className="flex flex-col h-screen bg-black text-white p-6">
      {/* Top: Clock left half, Weather right half */}
      <div className="flex items-center">
        <div className="flex-1 flex justify-center">
          <Clock />
        </div>
        <div className="flex-1 flex justify-center">
          <Weather />
        </div>
      </div>

      {/* Middle: Calendar left, CTAs right */}
      <div className="flex-1 flex items-start pt-8 gap-12">
        <Calendar />
        <div className="flex-1">
          {/* Future CTAs: "Qu'est-ce qu'on mange?", "Derniers films Plex", etc. */}
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
