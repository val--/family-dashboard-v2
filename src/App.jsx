import { useState, useEffect } from 'react'

function App() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const time = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const date = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex items-center justify-center h-screen bg-black text-white">
      <div className="text-center">
        <div className="text-8xl font-light tracking-wide">{time}</div>
        <div className="mt-4 text-2xl font-light capitalize text-white/70">
          {date}
        </div>
      </div>
    </div>
  )
}

export default App
