import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'https://api.openweathermap.org/data/2.5'
const REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes

export function useWeather() {
  const [current, setCurrent] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const apiKey = import.meta.env.VITE_WEATHER_API_KEY
  const city = import.meta.env.VITE_WEATHER_CITY || 'Paris'
  const units = import.meta.env.VITE_WEATHER_UNITS || 'metric'
  const lang = import.meta.env.VITE_WEATHER_LANG || 'fr'

  const fetchWeather = useCallback(async () => {
    if (!apiKey) {
      setError('VITE_WEATHER_API_KEY missing in .env')
      setLoading(false)
      return
    }

    const params = new URLSearchParams({ q: city, units, lang, appid: apiKey })

    try {
      const [currentRes, forecastRes] = await Promise.all([
        fetch(`${API_BASE}/weather?${params}`),
        fetch(`${API_BASE}/forecast?${params}`),
      ])

      if (!currentRes.ok || !forecastRes.ok) {
        throw new Error('Weather API request failed')
      }

      const [currentData, forecastData] = await Promise.all([
        currentRes.json(),
        forecastRes.json(),
      ])

      setCurrent(currentData)
      setForecast(forecastData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [apiKey, city, units, lang])

  useEffect(() => {
    fetchWeather()
    const interval = setInterval(fetchWeather, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchWeather])

  return { current, forecast, loading, error }
}
