# Family Dashboard v2

A lightweight family dashboard designed for 7-inch displays. Built with React, Vite, and Tailwind CSS.

## Features

- Clock with current time and date (French locale)
- Weather widget: current conditions + 4-day forecast (OpenWeatherMap)

## Setup

### Prerequisites

- An [OpenWeatherMap](https://openweathermap.org/api) API key (free tier works)

### Configuration

Copy the example env file and fill in your API key:

```sh
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_WEATHER_API_KEY` | — | OpenWeatherMap API key (required) |
| `VITE_WEATHER_CITY` | `Paris` | City name |
| `VITE_WEATHER_UNITS` | `metric` | `metric` / `imperial` |
| `VITE_WEATHER_LANG` | `fr` | Language for weather descriptions |

### Run with Docker (recommended)

```sh
docker compose up -d --build
```

The dashboard will be available at `http://localhost:3000`.

### Run locally

```sh
npm install
npm run dev
```
