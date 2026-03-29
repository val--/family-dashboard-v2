import Clock from './components/Clock'
import Weather from './components/Weather'
import Calendar from './components/Calendar'
import Plex from './components/Plex'
import Hue from './components/Hue'
import WidgetCarousel from './components/WidgetCarousel'

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

      {/* Swipeable widgets */}
      <div className="flex-1 overflow-hidden pt-4">
        <WidgetCarousel titles={['Agenda', 'Plex', 'Hue']}>
          <Calendar />
          <Plex />
          <Hue />
        </WidgetCarousel>
      </div>
    </div>
  )
}

export default App
