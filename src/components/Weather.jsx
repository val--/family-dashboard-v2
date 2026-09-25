function weatherIconUrl(code) {
  return `https://openweathermap.org/img/wn/${code}@2x.png`
}

function DayForecast({ label, icon, tempMin, tempMax }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs capitalize text-white/60">{label}</span>
      <img src={weatherIconUrl(icon)} alt="" className="w-8 h-8 -my-1" />
      <div className="text-xs">
        <span className="text-white">{tempMax}°</span> <span className="text-white/60">{tempMin}°</span>
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

export default function Weather({ weather }) {
  const { current, forecast, loading, error } = weather

  if (error) {
    return <div className="text-red-400 text-sm">{error}</div>
  }

  if (loading || !current) {
    return <div className="text-white/60 text-sm">Chargement météo…</div>
  }

  const temp = Math.round(current.main.temp)
  const description = current.weather[0].description
  const icon = current.weather[0].icon
  const days = forecast ? groupForecastByDay(forecast.list).slice(0, 3) : []

  return (
    <div className="flex items-center gap-6">
      {/* Current */}
      <div className="flex items-center gap-2">
        <img src={weatherIconUrl(icon)} alt={description} className="w-10 h-10" />
        <div>
          <div className="text-3xl font-light leading-none">{temp}°</div>
          <div className="mt-1 text-sm capitalize text-white/70">{description}</div>
        </div>
      </div>

      {/* Forecast */}
      {days.length > 0 && (
        <div className="flex gap-4">
          {days.map((day) => (
            <DayForecast key={day.label} {...day} />
          ))}
        </div>
      )}
    </div>
  )
}
