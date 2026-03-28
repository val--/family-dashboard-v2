import Clock from './components/Clock'
import Weather from './components/Weather'
import Printer from './components/Printer'
import Calendar from './components/Calendar'

function App() {
  return (
    <div className="flex flex-col h-screen bg-black text-white p-6">
      {/* Top: Clock centered */}
      <div className="text-center">
        <Clock />
      </div>

      {/* Middle: Calendar left, Weather right */}
      <div className="flex-1 flex items-center justify-center gap-12">
        <Calendar />
        <Weather />
      </div>

      {/* Bottom: Printer status */}
      <div className="text-center pb-2">
        <Printer />
      </div>
    </div>
  )
}

export default App
