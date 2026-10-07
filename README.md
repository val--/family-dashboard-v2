# Family Dashboard v2

A family dashboard for a small touchscreen (a 7-inch, 800×480 display on a Raspberry Pi), served by a home
server. It shows the family agenda, a post-it board the family writes to from their phones, the lights, what's
new on Plex, the state of the devices at home, and turns into a quiet night-stand screen when nobody touches it.

Built with React, Vite and Tailwind CSS (front) and Flask (API), both run with Docker. The interface is in
French.

## What's on the screen

**Header**: clock, current weather (OpenWeatherMap), and three buttons: sleep, settings, reload.

**Tabs** (tap a title or swipe; tapping the current tab again goes back to its first page):

| Tab | What it shows |
|---|---|
| Agenda | Upcoming events of a shared Google Calendar: the next weeks as cards, later ones as a list, details on tap. |
| Post-it | The family's notes, newest first. Each has a text, a color, an optional sticker, and a photo or a 10-second video. Tap one for the full view (arrows to browse, photo/video full screen with a QR code to download it). A QR code opens the phone page to write one (and delete your own). |
| Lumières | Philips Hue: pick a room, switch it on or off and dim it, recall one of its scenes in a tap (shown as round swatches of their colors, the active one circled), or switch its lights one by one. |
| Films | Movies recently added to Plex, Radarr downloads and missing movies, "Je cherche un film" (search, add to Radarr, French titles and streaming availability from TMDb), and fact-checked anecdotes about the last movie watched. |
| Séries | Shows in progress ("on deck") and recently added episodes on Plex, Sonarr downloads. |
| Appareils | VPN (gluetun: public IP and its location), the server (CPU, RAM, temperature, network, disks), a Recalbox console, and the printer (with a test page). |

**Screensaver** (after a delay, or with the moon button): a big clock, the date, the weather and a line
about today's or tomorrow's events on the left. On the right, a small notification center goes round:

- the recent post-its (today's, else yesterday's, by default), a note that just arrived first;
- then the movies just added to Plex: poster, summary, main actors with their photos, over a dimmed
  backdrop of the movie;
- then the latest episode added of each show the family has started (at least one episode watched), with
  no spoiler: the show's poster, the episode's own summary only once it was watched; until then a short
  "Dans l'épisode précédent" / "Il y a N épisodes" reminder of where the story was left, written by Gemini
  from Plex's summaries of the last episodes watched (and checked like the trivia);
- then the last movie watched (for a few days after), with two of its anecdotes (the Films tab's ones);
- story-like segments under it show where you are; tap one to jump to it;
- with nothing to show and no post-it for two days, a big QR code invites the family to post.

Under the agenda line, up to 4 light scenes chosen in Settings and "Éteindre" (every light of the home)
sit dimmed; a tap recalls the scene without waking the screen.

A tap on a note or a movie wakes the dashboard on it; a tap anywhere else just wakes it.

**Settings** (gear button): screensaver delay, time per item, which post-its go round, how recent a
movie or an episode must be to be shown, how long the last movie watched stays, and the screensaver's light shortcuts. They are stored by the API, so every screen shares them.

**Kiosk care**: the page reloads itself every night at 04:00 (Chromium slowly piles up memory on a Pi) and
after a new deployment once the screen is asleep; each widget fails on its own ("Indisponible pour le
moment") instead of blanking the screen; videos only play while on screen.

Handy URL parameters: `?tab=films` opens a tab (the current one is kept in the URL, so a reload stays on
it), `?idle=10` sets the screensaver delay to 10 seconds (to try it).

## Architecture

```
dashboard  → static React app served by nginx (port 3000), two pages:
               /         the kiosk dashboard
               /postit   the phone page to write a post-it (opened from the QR code)
api        → Flask (gunicorn, port 5100), one module per feature, data in ./data
```

| API module | Routes | Talks to |
|---|---|---|
| `agenda.py` | `/api/calendar` | Google Calendar (service account), cached 5 min |
| `plex.py` | `/api/plex/recent`, `/shows`, `/ondeck`, `/new-episodes`, `/last-watched`, `/trivia` | Plex (posters, cast photos and backdrops resized by Plex itself) |
| `trivia.py` | (used by `/api/plex/trivia`) | Gemini, with sources fetched from Allociné and Wikipedia |
| `recaps.py` | (used by `/api/plex/new-episodes`) | Gemini, from Plex's own episode summaries |
| `hue.py` | `/api/hue`, `/api/hue/lights/<id>`, `/groups/<id>`, `/scenes/<id>/recall` | the Philips Hue bridge (local API v2): switch, dim, recall a scene, nothing else |
| `arr.py` | `/api/radarr/*`, `/api/sonarr/status`, `/api/tmdb/streaming/<id>` | Radarr, Sonarr, TMDb |
| `postits.py` | `/api/postits*` | SQLite + photo/video files; ffmpeg for videos |
| `postit_stickers.py` | (background worker) | ComfyUI, for the die-cut sticker version of each photo |
| `settings.py` | `/api/settings` | `data/settings.json` |
| `vpn.py` | `/api/vpn` | the gluetun container, through the Docker socket |
| `system.py` | `/api/system` | the host's `/proc` and disks |
| `printer.py` | `/api/printer`, `/api/printer/test` | the host's CUPS, USB |
| `recalbox.py` | `/api/recalbox` | a Recalbox console on the LAN (read only) |

`./data` holds everything the API keeps: `postits.db` (SQLite), `photos/` (post-it photos, stickers and
videos), `settings.json`, `trivia.json` and `recaps.json`.

**The API has no login**: it is meant for the home LAN only. The post-it board asks for a family code once
per phone, which keeps a guest's phone out, not an attacker. Don't expose ports 3000 and 5100 to the
internet.

## Setup

### 1. Configuration

```sh
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_WEATHER_API_KEY` | — | OpenWeatherMap API key |
| `VITE_WEATHER_CITY` | `Paris` | City name |
| `VITE_WEATHER_UNITS` | `metric` | `metric` / `imperial` |
| `VITE_WEATHER_LANG` | `fr` | Language of the weather descriptions |
| `VITE_API_URL` | `http://localhost:5100` | API address as seen by the kiosk and the phones (the server's LAN IP) |
| `VITE_DEMO` | — | `true` to show mock data, no API needed (development) |
| `CALENDAR_ID` | — | Google Calendar ID |
| `PLEX_TOKEN` | — | Plex token |
| `PLEX_URL` | `http://host-gateway:32400` | Plex as seen from the API container |
| `PLEX_PUBLIC_URL` | `http://localhost:32400` | Plex as seen from the browsers (the server's LAN IP): images come from there |
| `RADARR_URL` / `RADARR_API_KEY` | `http://host-gateway:7878` / — | Radarr (key in Settings > General) |
| `SONARR_URL` / `SONARR_API_KEY` | `http://host-gateway:8989` / — | Sonarr |
| `TMDB_API_KEY` | — | TMDb: French titles in the movie search, streaming availability |
| `GEMINI_API_KEY` | — | Movie anecdotes (off without it) |
| `TRIVIA_WRITE_MODEL` / `TRIVIA_CHECK_MODEL` | `gemini-2.5-flash` / `gemini-3.1-pro-preview` | Models that write and fact-check the anecdotes |
| `FAMILY_MEMBERS` | — | Comma-separated first names offered on the phone page (required for the post-its) |
| `FAMILY_CODE` | — | 4-digit code asked once per phone (empty: no code) |
| `COMFYUI_URL` | — | ComfyUI address, to make die-cut stickers from post-it photos (off when empty) |
| `RECALBOX_HOST` | — | Recalbox IP or host name (card hidden when empty) |
| `HUE_BRIDGE_IP` / `HUE_APP_KEY` | — | Philips Hue bridge address and application key (the Lumières tab) |
| `SYSTEM_DISKS` | see `docker-compose.yml` | Disks of the server card, as `Label:path;Label:path` (paths seen from the container; the host's `/mnt` is `/host/mnt`) |
| `SYSTEM_NET_INTERFACE` | `enp7s0` | Network interface whose traffic the server card shows |

Every service is optional: a widget whose key is missing simply doesn't show (the weather says the key is
missing instead).

### 2. Google Calendar

1. Create a [Google Cloud](https://console.cloud.google.com/) project and enable the Google Calendar API
2. Create a service account and download its JSON key
3. Share the calendar with the service account's email (read-only)
4. Put the key at `credentials/service-account.json`

### 3. Post-it stickers with ComfyUI (optional)

Each photo posted can also get a die-cut "sticker" version (tap the folded corner of a note to switch).
This needs ComfyUI on the server with the custom node and the model described in
[`comfyui/README.md`](comfyui/README.md), and `COMFYUI_URL` in `.env`. Without it, photos stay photos.

### 4. Run with Docker

```sh
docker compose up -d --build
```

The dashboard is at `http://<server>:3000`, the phone page at `http://<server>:3000/postit` (the kiosk
shows its QR code; phones must be on the home Wi-Fi). After a change, rebuild only what changed:
`docker compose up -d --build dashboard` (front) or `api`. The kiosk picks up a new front by itself, the
next time it goes to sleep.

### 5. The kiosk

Open `http://<server>:3000` full screen in Chromium's kiosk mode on the Pi. Everything is sized for
800×480.

## Data and backups

The post-it board (database, photos, videos, stickers) and the settings are backed up every night at 03:30
to a NAS, by `scripts/backup-postits.sh`: one dated snapshot per day, unchanged files hard-linked to the
previous one, 30 days kept. It refuses to run if the NAS isn't mounted. Install the timer as a user service
(edit the path in `postits-backup.service` and `BACKUP_DIR` first if needed):

```sh
ln -s "$PWD"/scripts/systemd/postits-backup.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now postits-backup.timer
loginctl enable-linger "$USER"   # so it runs without anyone logged in
```

To restore: stop the API, copy `postits.db`, `photos/` and `settings.json` from a snapshot into `./data/`,
start the API again.

## Development

Start the API in Docker, then Vite's dev server:

```sh
docker compose up -d api
npm install
npm run dev -- --host
```

The dashboard is then at `http://<your-ip>:5173` with hot reload (the phone page at `/postit.html`). To work
without the API, set `VITE_DEMO=true` in `.env` (mock data).

Once done, deploy:

```sh
docker compose up -d --build dashboard
```

### Tests

Everything runs in Docker (nothing to install), on a throwaway data folder with a fake family:

```sh
scripts/test.sh          # API (pytest, in the API image: same Python and ffmpeg) + front (Vitest)
scripts/test.sh api      # only the API
scripts/test.sh front    # only the front
```

- `api/tests/`: settings, post-its (family code, throttling, photos, video cut and encoding, downloads),
  Hue (rooms and scenes from a fake bridge, value checks), and the pure helpers (trivia check, Recalbox, Plex parsing and cache).
- `src/**/*.test.js(x)`: what the screensaver shows (`src/lib/screensaver.js`), the shared polling
  hook, time helpers, and the post-it note (photo or video).
