import Clock from './components/Clock'
import Weather from './components/Weather'

function App() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-12">
      <Clock />
      <Weather />
    </div>
  )
}

export default App
