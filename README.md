# Family Dashboard v2

A lightweight family dashboard designed for 7-inch displays. Built with React, Vite, and Tailwind CSS.

## Features

- Clock with current time and date (French locale)
- Weather: current conditions + 4-day forecast (OpenWeatherMap)
- Google Calendar: upcoming events from a shared family agenda
- Plex: recently added movies with cover art and watched indicator
- Printer status: online/offline indicator (HP Deskjet via CUPS)

## Architecture

```
dashboard   → Static React app served by nginx (port 3000)
api         → Python Flask backend for printer & calendar (port 5100)
```

## Setup

### 1. Configuration

```sh
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_WEATHER_API_KEY` | — | OpenWeatherMap API key (required) |
| `VITE_WEATHER_CITY` | `Paris` | City name |
| `VITE_WEATHER_UNITS` | `metric` | `metric` / `imperial` |
| `VITE_WEATHER_LANG` | `fr` | Language for weather descriptions |
| `VITE_API_URL` | `http://localhost:5100` | Backend API URL (use LAN IP for remote access) |
| `VITE_DEMO` | — | Set to `true` to use mock data (no API needed) |
| `CALENDAR_ID` | — | Google Calendar ID |
| `PLEX_TOKEN` | — | Plex authentication token |

### 2. Google Calendar (optional)

1. Create a [Google Cloud](https://console.cloud.google.com/) project and enable the Google Calendar API
2. Create a service account and download the JSON key
3. Share your calendar with the service account email (read-only)
4. Place the key at `credentials/service-account.json`

### 3. Run with Docker

```sh
docker compose up -d --build
```

The dashboard will be available at `http://localhost:3000`.

### Development with hot reload

Start the API service in Docker, then run Vite's dev server directly:

```sh
docker compose up -d api
npm install
npm run dev -- --host
```

The dashboard will be available at `http://<your-ip>:5173` with hot reload.
Printer, calendar and Plex features require the `api` service running.

To develop without the API, enable demo mode with mock data:

```sh
# Add to .env
VITE_DEMO=true
```

Once done, deploy to production:

```sh
docker compose up -d --build dashboard
```
