import os
import subprocess
from datetime import datetime, timedelta, timezone

from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# -- Printer config --
PRINTER_NAME = "Deskjet_3630"
USB_ID = "03f0:e311"

# -- Plex config --
PLEX_URL = os.environ.get("PLEX_URL", "http://localhost:32400")
PLEX_PUBLIC_URL = os.environ.get("PLEX_PUBLIC_URL", PLEX_URL)
PLEX_TOKEN = os.environ.get("PLEX_TOKEN", "")

# -- Radarr config --
RADARR_URL = os.environ.get("RADARR_URL", "http://localhost:7878")
RADARR_API_KEY = os.environ.get("RADARR_API_KEY", "")

# -- Calendar config --
CALENDAR_ID = os.environ.get("CALENDAR_ID", "")
CREDENTIALS_PATH = os.environ.get("CREDENTIALS_PATH", "/app/credentials/service-account.json")


# ========================
#  Printer
# ========================

def is_usb_connected():
    try:
        result = subprocess.run(["lsusb"], capture_output=True, text=True, timeout=5)
        return USB_ID in result.stdout
    except Exception:
        return False


def get_cups_status():
    try:
        result = subprocess.run(
            ["lpstat", "-p", PRINTER_NAME],
            capture_output=True, text=True, timeout=5,
        )
        output = result.stdout.strip()
        if "idle" in output:
            return "idle"
        if "printing" in output:
            return "printing"
        if "disabled" in output:
            return "disabled"
        return output or "unknown"
    except Exception:
        return "unknown"


@app.route("/api/printer")
def printer_status():
    connected = is_usb_connected()
    status = get_cups_status() if connected else "offline"

    return jsonify({
        "name": PRINTER_NAME,
        "connected": connected,
        "status": status,
    })


# ========================
#  Calendar
# ========================

def get_calendar_service():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    credentials = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH,
        scopes=["https://www.googleapis.com/auth/calendar.readonly"],
    )
    return build("calendar", "v3", credentials=credentials)


@app.route("/api/calendar")
def calendar_events():
    if not CALENDAR_ID:
        return jsonify({"error": "CALENDAR_ID not configured"}), 500

    try:
        service = get_calendar_service()
        now = datetime.now(timezone.utc)
        time_max = now + timedelta(days=365)

        result = service.events().list(
            calendarId=CALENDAR_ID,
            timeMin=now.isoformat(),
            timeMax=time_max.isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=250,
        ).execute()

        events = []
        for item in result.get("items", []):
            start = item["start"].get("dateTime", item["start"].get("date", ""))
            end = item["end"].get("dateTime", item["end"].get("date", ""))
            is_all_day = "date" in item["start"]

            events.append({
                "title": item.get("summary", "Sans titre"),
                "start": start,
                "end": end,
                "allDay": is_all_day,
                "location": item.get("location"),
            })

        return jsonify({"events": events})

    except FileNotFoundError:
        return jsonify({"error": "Service account credentials not found"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ========================
#  Plex
# ========================

def parse_plex_movie(item):
    """Extract movie info from a Plex XML element."""
    thumb = item.get("thumb")
    duration_ms = item.get("duration")
    duration_min = round(int(duration_ms) / 60000) if duration_ms else None

    genres = [g.get("tag") for g in item.findall("Genre")]
    directors = [d.get("tag") for d in item.findall("Director")]
    roles = [r.get("tag") for r in item.findall("Role")]

    return {
        "title": item.get("title"),
        "year": item.get("year"),
        "summary": item.get("summary"),
        "rating": item.get("audienceRating"),
        "contentRating": item.get("contentRating"),
        "duration": duration_min,
        "genres": genres[:4],
        "directors": directors[:2],
        "actors": roles[:5],
        "addedAt": item.get("addedAt"),
        "lastViewedAt": item.get("lastViewedAt"),
        "thumb": f"{PLEX_PUBLIC_URL}{thumb}?X-Plex-Token={PLEX_TOKEN}" if thumb else None,
        "watched": int(item.get("viewCount", 0)) > 0,
    }


@app.route("/api/plex/recent")
def plex_recent():
    if not PLEX_TOKEN:
        return jsonify({"error": "PLEX_TOKEN not configured"}), 500

    try:
        import urllib.request
        import xml.etree.ElementTree as ET

        url = f"{PLEX_URL}/library/recentlyAdded?X-Plex-Token={PLEX_TOKEN}"
        req = urllib.request.Request(url, headers={"Accept": "application/xml"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            tree = ET.parse(resp)

        movies = []
        for item in tree.getroot():
            if item.get("type") != "movie":
                continue
            movies.append(parse_plex_movie(item))
            if len(movies) >= 8:
                break

        return jsonify({"movies": movies})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/plex/last-watched")
def plex_last_watched():
    if not PLEX_TOKEN:
        return jsonify({"error": "PLEX_TOKEN not configured"}), 500

    try:
        import urllib.request
        import xml.etree.ElementTree as ET

        url = (
            f"{PLEX_URL}/library/sections/1/all"
            f"?type=1&sort=lastViewedAt:desc&X-Plex-Container-Size=1&X-Plex-Token={PLEX_TOKEN}"
        )
        req = urllib.request.Request(url, headers={"Accept": "application/xml"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            tree = ET.parse(resp)

        for item in tree.getroot():
            if not item.get("lastViewedAt"):
                return jsonify(None)
            return jsonify(parse_plex_movie(item))

        return jsonify(None)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ========================
#  Radarr
# ========================

@app.route("/api/radarr/status")
def radarr_status():
    if not RADARR_API_KEY:
        return jsonify({"error": "RADARR_API_KEY not configured"}), 500

    try:
        import urllib.request
        import json as jsonlib

        headers = {"X-Api-Key": RADARR_API_KEY}

        # Fetch queue (downloading)
        queue_url = f"{RADARR_URL}/api/v3/queue?pageSize=10&includeMovie=true"
        req = urllib.request.Request(queue_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            queue_data = jsonlib.loads(resp.read())

        seen_movies = {}
        for record in queue_data.get("records", []):
            if record.get("status") != "downloading":
                continue
            movie = record.get("movie", {})
            movie_id = record.get("movieId")
            progress = round(100 - (record.get("sizeleft", 0) / max(record.get("size", 1), 1) * 100))
            poster = None
            for img in movie.get("images", []):
                if img.get("coverType") == "poster":
                    poster = img.get("remoteUrl")
                    break
            if movie_id not in seen_movies or progress > seen_movies[movie_id]["progress"]:
                seen_movies[movie_id] = {
                    "title": movie.get("title"),
                    "year": movie.get("year"),
                    "progress": progress,
                    "eta": record.get("estimatedCompletionTime"),
                    "poster": poster,
                }
        downloading = list(seen_movies.values())

        # Fetch missing/monitored movies
        movie_url = f"{RADARR_URL}/api/v3/movie"
        req = urllib.request.Request(movie_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            all_movies = jsonlib.loads(resp.read())

        missing = []
        for movie in all_movies:
            if movie.get("monitored") and not movie.get("hasFile"):
                missing.append({
                    "title": movie.get("title"),
                    "year": movie.get("year"),
                })

        return jsonify({
            "downloading": downloading,
            "missing": missing,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5100)
