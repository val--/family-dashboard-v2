import os
import subprocess
import urllib.parse
import urllib.request
import json as jsonlib
from datetime import datetime, timedelta, timezone

from flask import Flask, jsonify, request
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

# -- TMDb config --
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")

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


# ========================
#  Radarr
# ========================

@app.route("/api/radarr/status")
def radarr_status():
    if not RADARR_API_KEY:
        return jsonify({"error": "RADARR_API_KEY not configured"}), 500

    try:
        queue_data = radarr_request("/api/v3/queue?pageSize=10&includeMovie=true")

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
        all_movies = radarr_request("/api/v3/movie")

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


def radarr_request(path, method="GET", data=None):
    """Helper for Radarr API calls."""
    headers = {"X-Api-Key": RADARR_API_KEY, "Content-Type": "application/json"}
    url = f"{RADARR_URL}{path}"
    req = urllib.request.Request(url, headers=headers, method=method)
    if data:
        req.data = jsonlib.dumps(data).encode()
    with urllib.request.urlopen(req, timeout=10) as resp:
        return jsonlib.loads(resp.read())


@app.route("/api/radarr/search")
def radarr_search():
    if not RADARR_API_KEY:
        return jsonify({"error": "RADARR_API_KEY not configured"}), 500

    term = request.args.get("term", "").strip()
    if not term:
        return jsonify({"results": []})

    try:
        encoded = urllib.parse.quote(term)
        data = radarr_request(f"/api/v3/movie/lookup?term={encoded}")

        # Get existing library tmdbIds for duplicate check
        library = radarr_request("/api/v3/movie")
        library_ids = {m.get("tmdbId") for m in library}

        results = []
        for movie in data[:10]:
            poster = None
            for img in movie.get("images", []):
                if img.get("coverType") == "poster":
                    poster = img.get("remoteUrl")
                    break
            results.append({
                "tmdbId": movie.get("tmdbId"),
                "title": movie.get("title"),
                "year": movie.get("year"),
                "overview": movie.get("overview", ""),
                "runtime": movie.get("runtime"),
                "ratings": movie.get("ratings", {}),
                "genres": [g for g in movie.get("genres", [])][:4],
                "poster": poster,
                "inLibrary": movie.get("tmdbId") in library_ids,
            })

        return jsonify({"results": results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/radarr/config")
def radarr_config():
    if not RADARR_API_KEY:
        return jsonify({"error": "RADARR_API_KEY not configured"}), 500

    try:
        root_folders = radarr_request("/api/v3/rootfolder")
        profiles = radarr_request("/api/v3/qualityprofile")

        return jsonify({
            "rootFolderPath": root_folders[0]["path"] if root_folders else "/movies",
            "qualityProfileId": profiles[0]["id"] if profiles else 1,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/radarr/add", methods=["POST"])
def radarr_add():
    if not RADARR_API_KEY:
        return jsonify({"error": "RADARR_API_KEY not configured"}), 500

    try:
        body = request.get_json()
        tmdb_id = body.get("tmdbId")
        if not tmdb_id:
            return jsonify({"error": "tmdbId required"}), 400

        # Get config — pick root folder with most free space
        config = radarr_request("/api/v3/rootfolder")
        profiles = radarr_request("/api/v3/qualityprofile")
        root_folder = max(config, key=lambda f: f.get("freeSpace", 0))["path"] if config else "/movies"
        quality_id = profiles[0]["id"] if profiles else 1

        # Lookup full movie details
        movie = radarr_request(f"/api/v3/movie/lookup/tmdb?tmdbId={tmdb_id}")

        result = radarr_request("/api/v3/movie", method="POST", data={
            "tmdbId": tmdb_id,
            "title": movie.get("title"),
            "year": movie.get("year"),
            "qualityProfileId": quality_id,
            "rootFolderPath": root_folder,
            "monitored": True,
            "addOptions": {"searchForMovie": True},
        })

        return jsonify({"success": True, "title": result.get("title")})

    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else str(e)
        return jsonify({"error": error_body}), e.code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tmdb/streaming/<int:tmdb_id>")
def tmdb_streaming(tmdb_id):
    if not TMDB_API_KEY:
        return jsonify({"error": "TMDB_API_KEY not configured"}), 500

    try:
        url = f"https://api.themoviedb.org/3/movie/{tmdb_id}/watch/providers?api_key={TMDB_API_KEY}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = jsonlib.loads(resp.read())

        # Get French providers (fallback to US)
        country = data.get("results", {}).get("FR") or data.get("results", {}).get("US")
        if not country:
            return jsonify({"providers": []})

        providers = []
        for p in country.get("flatrate", []):
            providers.append({
                "name": p.get("provider_name"),
                "logo": f"https://image.tmdb.org/t/p/w92{p['logo_path']}" if p.get("logo_path") else None,
            })

        return jsonify({"providers": providers})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5100)
