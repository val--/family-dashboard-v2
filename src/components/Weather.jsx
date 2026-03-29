import { useWeather } from '../hooks/useWeather'

function weatherIconUrl(code) {
  return `https://openweathermap.org/img/wn/${code}@2x.png`
}

function DayForecast({ label, icon, tempMin, tempMax }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs text-white/50">{label}</span>
      <img src={weatherIconUrl(icon)} alt="" className="w-7 h-7" />
      <div className="text-xs">
        <span className="text-white/50">{tempMin}°</span>
        <span className="mx-0.5">/</span>
        <span>{tempMax}°</span>
      </div>
    </div>
  )
}

function groupForecastByDay(list) {
  const days = {}
  for (const item of list) {
    const date = new Date(item.dt * 1000)
    const key = date.toLocaleDateString('fr-FR', { weekday: 'short' })
    if (!days[key]) {
      days[key] = { temps: [], icons: [] }
    }
    days[key].temps.push(item.main.temp)
    days[key].icons.push(item.weather[0].icon)
  }

  return Object.entries(days).map(([label, data]) => ({
    label,
    tempMin: Math.round(Math.min(...data.temps)),
    tempMax: Math.round(Math.max(...data.temps)),
    icon: data.icons[Math.floor(data.icons.length / 2)],
  }))
}

export default function Weather() {
  const { current, forecast, loading, error } = useWeather()

  if (error) {
    return <div className="text-red-400 text-sm">{error}</div>
  }

  if (loading || !current) {
    return <div className="text-white/30 text-sm">Chargement météo…</div>
  }

  const temp = Math.round(current.main.temp)
  const description = current.weather[0].description
  const icon = current.weather[0].icon
  const days = forecast ? groupForecastByDay(forecast.list).slice(0, 4) : []

  return (
    <div className="flex items-center gap-4">
      {/* Current */}
      <div className="flex items-center gap-2">
        <img src={weatherIconUrl(icon)} alt={description} className="w-10 h-10" />
        <div>
          <div className="text-2xl font-light">{temp}°</div>
          <div className="text-xs text-white/50 capitalize">{description}</div>
        </div>
      </div>

      {/* Forecast */}
      {days.length > 0 && (
        <div className="flex gap-3">
          {days.map((day) => (
            <DayForecast key={day.label} {...day} />
          ))}
        </div>
      )}
    </div>
  )
}
