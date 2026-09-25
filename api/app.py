import os
import re
import subprocess
import time
import urllib.parse
import urllib.request
import json as jsonlib
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

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

# -- Sonarr config --
SONARR_URL = os.environ.get("SONARR_URL", "http://localhost:8989")
SONARR_API_KEY = os.environ.get("SONARR_API_KEY", "")

# -- TMDb config --
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")

# -- Gemini config --
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

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


def count_print_jobs():
    """Number of jobs waiting on the printer queue."""
    try:
        result = subprocess.run(
            ["lpstat", "-o", PRINTER_NAME],
            capture_output=True, text=True, timeout=5,
        )
        return len([line for line in result.stdout.splitlines() if line.strip()])
    except Exception:
        return 0


@app.route("/api/printer")
def printer_status():
    connected = is_usb_connected()
    status = get_cups_status() if connected else "offline"

    return jsonify({
        "name": PRINTER_NAME,
        "connected": connected,
        "status": status,
        "jobs": count_print_jobs() if connected else 0,
    })


PRINT_TEST_TEXT = "Je fonctionne très bien!\n"
PRINT_TEST_COOLDOWN = 30  # seconds; the endpoint is open on the LAN, so avoid paper floods
PRINT_TEST_STAMP = "/tmp/.printer_test_last"  # shared between gunicorn workers


@app.route("/api/printer/test", methods=["POST"])
def printer_test():
    if not is_usb_connected() or get_cups_status() in ("offline", "disabled", "unknown"):
        return jsonify({"ok": False, "error": "Imprimante indisponible"}), 503

    try:
        elapsed = time.time() - os.path.getmtime(PRINT_TEST_STAMP)
    except OSError:
        elapsed = PRINT_TEST_COOLDOWN
    if elapsed < PRINT_TEST_COOLDOWN:
        wait = int(PRINT_TEST_COOLDOWN - elapsed) + 1
        return jsonify({"ok": False, "error": f"Patiente encore {wait} s"}), 429

    try:
        result = subprocess.run(
            ["lp", "-d", PRINTER_NAME, "-t", "Test dashboard"],
            input=PRINT_TEST_TEXT.encode("utf-8"),
            capture_output=True, timeout=10,
        )
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

    if result.returncode != 0:
        error = result.stderr.decode("utf-8", errors="ignore").strip() or "Échec de l'impression"
        return jsonify({"ok": False, "error": error}), 500

    with open(PRINT_TEST_STAMP, "w"):
        pass
    os.utime(PRINT_TEST_STAMP)
    return jsonify({"ok": True, "message": result.stdout.decode("utf-8", errors="ignore").strip()})


# ========================
#  VPN (gluetun)
# ========================

DOCKER_SOCKET = "/var/run/docker.sock"
GLUETUN_CONTAINER = "gluetun"
VPN_PROVIDER_NAMES = {"protonvpn": "ProtonVPN"}
VPN_PROTOCOL_NAMES = {"wireguard": "WireGuard", "openvpn": "OpenVPN"}

_geo_cache = {}  # ip -> {city, country, org}; only successful lookups are kept


def docker_request(method, path, body=None):
    """Minimal Docker Engine API call over the unix socket; returns the raw response body."""
    import http.client
    import socket

    conn = http.client.HTTPConnection("localhost")
    conn.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    conn.sock.settimeout(5)
    conn.sock.connect(DOCKER_SOCKET)
    try:
        payload = jsonlib.dumps(body) if body is not None else None
        headers = {"Content-Type": "application/json"} if payload else {}
        conn.request(method, path, body=payload, headers=headers)
        return conn.getresponse().read()
    finally:
        conn.close()


def docker_exec_output(container, cmd):
    """Run a command in a container and return its stdout (demultiplexed)."""
    exec_id = jsonlib.loads(docker_request(
        "POST", f"/containers/{container}/exec",
        {"AttachStdout": True, "Cmd": cmd},
    )).get("Id")
    raw = docker_request("POST", f"/exec/{exec_id}/start", {"Detach": False})

    # Non-TTY streams are framed: 1 byte stream type, 3 padding bytes, 4 bytes big-endian length
    out, i = b"", 0
    while i + 8 <= len(raw):
        size = int.from_bytes(raw[i + 4:i + 8], "big")
        out += raw[i + 8:i + 8 + size]
        i += 8 + size
    return out.decode("utf-8", errors="ignore")


def lookup_ip_geo(ip):
    """City/country/org for an IP. Cached per IP: free geo APIs rate-limit (429) fast."""
    if ip in _geo_cache:
        return _geo_cache[ip]

    def ipwho():
        with urllib.request.urlopen(f"https://ipwho.is/{ip}", timeout=5) as r:
            data = jsonlib.loads(r.read())
        if not data.get("success"):
            raise ValueError("lookup failed")
        return {
            "city": data.get("city"),
            "country": data.get("country"),
            "org": (data.get("connection") or {}).get("org"),
        }

    def ipinfo():
        with urllib.request.urlopen(f"https://ipinfo.io/{ip}/json", timeout=5) as r:
            data = jsonlib.loads(r.read())
        return {"city": data.get("city"), "country": data.get("country"), "org": data.get("org")}

    for lookup in (ipwho, ipinfo):
        try:
            geo = lookup()
            _geo_cache[ip] = geo
            return geo
        except Exception:
            continue
    return {}


@app.route("/api/vpn")
def vpn_status():
    try:
        container = jsonlib.loads(docker_request("GET", f"/containers/{GLUETUN_CONTAINER}/json"))
        state = container.get("State", {})
        is_healthy = state.get("Health", {}).get("Status") == "healthy"

        # Only whitelisted, non-sensitive settings are read: the env also holds the WireGuard key
        env = dict(e.split("=", 1) for e in container.get("Config", {}).get("Env", []) if "=" in e)
        provider = env.get("VPN_SERVICE_PROVIDER", "")
        protocol = env.get("VPN_TYPE", "")

        result = {
            "healthy": is_healthy,
            "provider": VPN_PROVIDER_NAMES.get(provider, provider) or None,
            "protocol": VPN_PROTOCOL_NAMES.get(protocol, protocol) or None,
            "since": (state.get("StartedAt") or "")[:19] + "Z" if state.get("StartedAt") else None,
            "ip": None,
            "port": None,
            "city": None,
            "country": None,
            "org": None,
        }

        if is_healthy:
            try:
                out = docker_exec_output(
                    GLUETUN_CONTAINER,
                    ["sh", "-c", "cat /tmp/gluetun/ip; echo; cat /tmp/gluetun/forwarded_port 2>/dev/null"],
                )
                lines = [line.strip() for line in out.splitlines()]
                ip = re.sub(r"[^0-9.]", "", lines[0]) if lines else ""
                port = re.sub(r"[^0-9]", "", lines[1]) if len(lines) > 1 else ""
                result["ip"] = ip or None
                result["port"] = int(port) if port else None
            except Exception:
                pass

            if result["ip"]:
                result.update(lookup_ip_geo(result["ip"]))

        return jsonify(result)

    except Exception as e:
        return jsonify({"healthy": False, "error": str(e)})


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

def plex_thumb_url(thumb, width=400, height=600):
    """Resized poster URL through Plex's transcoder (originals are ~2000x3000)."""
    if not thumb:
        return None
    src = urllib.parse.quote(thumb, safe="")
    return (
        f"{PLEX_PUBLIC_URL}/photo/:/transcode?width={width}&height={height}"
        f"&minSize=1&upscale=0&url={src}&X-Plex-Token={PLEX_TOKEN}"
    )


def parse_plex_episode(item):
    """Extract episode info from a Plex XML element."""
    thumb = item.get("grandparentThumb") or item.get("thumb")
    return {
        "show": item.get("grandparentTitle"),
        "season": int(item.get("parentIndex", 0)),
        "episode": int(item.get("index", 0)),
        "title": item.get("title"),
        "addedAt": item.get("addedAt"),
        "lastViewedAt": item.get("lastViewedAt"),
        "thumb": plex_thumb_url(thumb),
        "watched": int(item.get("viewCount", 0)) > 0,
        "year": item.get("year"),
        "summary": item.get("summary"),
        "rating": item.get("audienceRating") or item.get("rating"),
        "contentRating": item.get("contentRating"),
        "genres": [g.get("tag") for g in item.findall("Genre")][:4],
    }


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
        "thumb": plex_thumb_url(thumb),
        "watched": int(item.get("viewCount", 0)) > 0,
    }


@app.route("/api/plex/recent")
def plex_recent():
    if not PLEX_TOKEN:
        return jsonify({"error": "PLEX_TOKEN not configured"}), 500

    try:
        import urllib.request
        import xml.etree.ElementTree as ET

        section_key = find_plex_section(ET, "movie")
        if not section_key:
            return jsonify({"movies": []})

        url = f"{PLEX_URL}/library/sections/{section_key}/recentlyAdded?X-Plex-Token={PLEX_TOKEN}&X-Plex-Container-Size=50"
        req = urllib.request.Request(url, headers={"Accept": "application/xml"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            tree = ET.parse(resp)

        movies = []
        for item in tree.getroot():
            if item.get("type") != "movie":
                continue
            movies.append(parse_plex_movie(item))
            if len(movies) >= 20:
                break

        return jsonify({"movies": movies})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def find_plex_section(et_module, section_type):
    """Find the Plex library section key for a given type (e.g. 'show', 'movie')."""
    url = f"{PLEX_URL}/library/sections?X-Plex-Token={PLEX_TOKEN}"
    req = urllib.request.Request(url, headers={"Accept": "application/xml"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        tree = et_module.parse(resp)
    for directory in tree.getroot():
        if directory.get("type") == section_type:
            return directory.get("key")
    return None


@app.route("/api/plex/ondeck")
def plex_ondeck():
    if not PLEX_TOKEN:
        return jsonify({"error": "PLEX_TOKEN not configured"}), 500

    try:
        import xml.etree.ElementTree as ET

        url = f"{PLEX_URL}/library/onDeck?X-Plex-Token={PLEX_TOKEN}"
        req = urllib.request.Request(url, headers={"Accept": "application/xml"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            tree = ET.parse(resp)

        shows = []
        season_cache = {}

        for item in tree.getroot():
            if item.get("type") != "episode":
                continue

            thumb = item.get("grandparentThumb") or item.get("thumb")
            parent_key = item.get("parentRatingKey")
            season_num = int(item.get("parentIndex", 0))

            # Get season leaf counts (cached)
            watched = 0
            total = None
            if parent_key:
                if parent_key not in season_cache:
                    try:
                        s_url = f"{PLEX_URL}/library/metadata/{parent_key}?X-Plex-Token={PLEX_TOKEN}"
                        s_req = urllib.request.Request(s_url, headers={"Accept": "application/xml"})
                        with urllib.request.urlopen(s_req, timeout=5) as s_resp:
                            s_tree = ET.parse(s_resp)
                        s_el = s_tree.getroot().find(".//Directory")
                        if s_el is None:
                            s_el = s_tree.getroot()
                        season_cache[parent_key] = {
                            "leafCount": int(s_el.get("leafCount", 0)),
                            "viewedLeafCount": int(s_el.get("viewedLeafCount", 0)),
                        }
                    except Exception:
                        season_cache[parent_key] = {}

                meta = season_cache[parent_key]
                watched = meta.get("viewedLeafCount", 0)
                total = meta.get("leafCount") or None

            shows.append({
                "show": item.get("grandparentTitle"),
                "season": season_num,
                "watched": watched,
                "total": total,
                "thumb": plex_thumb_url(thumb),
                "nextEpisode": item.get("title"),
                "nextIndex": int(item.get("index", 0)),
            })

        return jsonify({"shows": shows})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/plex/shows")
def plex_shows():
    if not PLEX_TOKEN:
        return jsonify({"error": "PLEX_TOKEN not configured"}), 500

    try:
        import xml.etree.ElementTree as ET

        section_key = find_plex_section(ET, "show")
        if not section_key:
            return jsonify({"shows": []})

        url = f"{PLEX_URL}/library/sections/{section_key}/recentlyAdded?X-Plex-Token={PLEX_TOKEN}&X-Plex-Container-Size=50"
        req = urllib.request.Request(url, headers={"Accept": "application/xml"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            tree = ET.parse(resp)

        # Group episodes by show, keep the most recent episode per show
        shows = {}
        for item in tree.getroot():
            if item.get("type") != "episode":
                continue
            ep = parse_plex_episode(item)
            show_name = ep["show"]
            if show_name not in shows:
                shows[show_name] = ep
                shows[show_name]["episodes"] = 1
            else:
                shows[show_name]["episodes"] += 1
                # Keep the most recent addedAt
                if int(ep["addedAt"] or 0) > int(shows[show_name]["addedAt"] or 0):
                    episodes_count = shows[show_name]["episodes"]
                    shows[show_name] = ep
                    shows[show_name]["episodes"] = episodes_count

        # Sort by addedAt desc
        result = sorted(shows.values(), key=lambda s: int(s.get("addedAt") or 0), reverse=True)
        return jsonify({"shows": result[:20]})

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
            size_gb = round(record.get("size", 0) / (1024**3), 1)
            sizeleft_gb = round(record.get("sizeleft", 0) / (1024**3), 1)
            quality_name = record.get("quality", {}).get("quality", {}).get("name")

            if movie_id not in seen_movies or progress > seen_movies[movie_id]["progress"]:
                seen_movies[movie_id] = {
                    "title": movie.get("title"),
                    "year": movie.get("year"),
                    "progress": progress,
                    "eta": record.get("estimatedCompletionTime"),
                    "poster": poster,
                    "release": record.get("title"),
                    "quality": quality_name,
                    "size": size_gb,
                    "sizeleft": sizeleft_gb,
                    "downloadClient": record.get("downloadClient"),
                    "indexer": record.get("indexer"),
                    "timeleft": record.get("timeleft"),
                }
        downloading = list(seen_movies.values())

        # Fetch missing/monitored movies
        all_movies = radarr_request("/api/v3/movie")

        missing = []
        for movie in all_movies:
            if movie.get("monitored") and not movie.get("hasFile"):
                poster = None
                for img in movie.get("images", []):
                    if img.get("coverType") == "poster":
                        poster = img.get("remoteUrl")
                        break
                missing.append({
                    "title": movie.get("title"),
                    "year": movie.get("year"),
                    "poster": poster,
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

            title = movie.get("title")
            overview = movie.get("overview", "")

            # Fetch French title/overview from TMDb
            tmdb_id = movie.get("tmdbId")
            if TMDB_API_KEY and tmdb_id:
                try:
                    tmdb_url = f"https://api.themoviedb.org/3/movie/{tmdb_id}?api_key={TMDB_API_KEY}&language=fr-FR"
                    req = urllib.request.Request(tmdb_url)
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        tmdb_data = jsonlib.loads(resp.read())
                    if tmdb_data.get("title"):
                        title = tmdb_data["title"]
                    if tmdb_data.get("overview"):
                        overview = tmdb_data["overview"]
                except Exception:
                    pass

            results.append({
                "tmdbId": tmdb_id,
                "title": title,
                "year": movie.get("year"),
                "overview": overview,
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
            "profiles": [{"id": p["id"], "name": p["name"]} for p in profiles],
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

        quality_id = body.get("qualityProfileId")

        # Get config — pick root folder with most free space
        config = radarr_request("/api/v3/rootfolder")
        root_folder = max(config, key=lambda f: f.get("freeSpace", 0))["path"] if config else "/movies"
        if not quality_id:
            profiles = radarr_request("/api/v3/qualityprofile")
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


# ========================
#  Sonarr
# ========================

def sonarr_request(path, method="GET", data=None):
    """Helper for Sonarr API calls."""
    headers = {"X-Api-Key": SONARR_API_KEY, "Content-Type": "application/json"}
    url = f"{SONARR_URL}{path}"
    req = urllib.request.Request(url, headers=headers, method=method)
    if data:
        req.data = jsonlib.dumps(data).encode()
    with urllib.request.urlopen(req, timeout=10) as resp:
        return jsonlib.loads(resp.read())


@app.route("/api/sonarr/status")
def sonarr_status():
    if not SONARR_API_KEY:
        return jsonify({"error": "SONARR_API_KEY not configured"}), 500

    try:
        queue_data = sonarr_request("/api/v3/queue?pageSize=50&includeSeries=true&includeEpisode=true")

        # Group downloading items by series
        seen_series = {}
        for record in queue_data.get("records", []):
            if record.get("status") != "downloading":
                continue
            series = record.get("series", {})
            series_id = record.get("seriesId")
            episode = record.get("episode", {})
            size = record.get("size", 0)
            sizeleft = record.get("sizeleft", 0)
            progress = round(100 - (sizeleft / max(size, 1) * 100))

            poster = None
            for img in series.get("images", []):
                if img.get("coverType") == "poster":
                    poster = img.get("remoteUrl")
                    break

            size_gb = round(size / (1024**3), 1)
            sizeleft_gb = round(sizeleft / (1024**3), 1)
            quality_name = record.get("quality", {}).get("quality", {}).get("name")

            if series_id not in seen_series:
                seen_series[series_id] = {
                    "title": series.get("title"),
                    "year": series.get("year"),
                    "progress": progress,
                    "eta": record.get("estimatedCompletionTime"),
                    "poster": poster,
                    "release": record.get("title"),
                    "quality": quality_name,
                    "size": size_gb,
                    "sizeleft": sizeleft_gb,
                    "downloadClient": record.get("downloadClient"),
                    "indexer": record.get("indexer"),
                    "timeleft": record.get("timeleft"),
                    "episodeCount": 1,
                    "season": episode.get("seasonNumber"),
                    "episode": episode.get("episodeNumber"),
                }
            else:
                # Aggregate: sum sizes, recompute overall progress
                existing = seen_series[series_id]
                existing["episodeCount"] += 1
                total_size = existing["size"] + size_gb
                total_left = existing["sizeleft"] + sizeleft_gb
                existing["size"] = round(total_size, 1)
                existing["sizeleft"] = round(total_left, 1)
                existing["progress"] = round(100 - (total_left / max(total_size, 0.1) * 100))
                # Keep the latest ETA
                if record.get("estimatedCompletionTime") and (
                    not existing["eta"] or record["estimatedCompletionTime"] > existing["eta"]
                ):
                    existing["eta"] = record["estimatedCompletionTime"]
                    existing["timeleft"] = record.get("timeleft")

        downloading = list(seen_series.values())

        # Fetch missing/monitored episodes
        wanted = sonarr_request("/api/v3/wanted/missing?pageSize=20&includeSeries=true")

        missing_series = {}
        for record in wanted.get("records", []):
            series = record.get("series", {})
            sid = series.get("id")
            if sid in missing_series or sid in seen_series:
                continue
            poster = None
            for img in series.get("images", []):
                if img.get("coverType") == "poster":
                    poster = img.get("remoteUrl")
                    break
            missing_series[sid] = {
                "title": series.get("title"),
                "year": series.get("year"),
                "poster": poster,
                "season": record.get("seasonNumber"),
                "episode": record.get("episodeNumber"),
            }

        return jsonify({
            "downloading": downloading,
            "missing": list(missing_series.values()),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ========================
#  Trivia (Gemini)
# ========================

_trivia_cache = {"movie": None, "text": None, "error_until": 0, "generated_at": 0}

GEMINI_COOLDOWN = 120  # seconds to wait after a failed Gemini call
TRIVIA_TTL = 30 * 60  # regenerate trivia every 30 minutes even for the same movie


@app.route("/api/plex/trivia")
def plex_trivia():
    import time

    if not GEMINI_API_KEY:
        return jsonify({"error": "GEMINI_API_KEY not configured"}), 500
    if not PLEX_TOKEN:
        return jsonify({"error": "PLEX_TOKEN not configured"}), 500

    try:
        import xml.etree.ElementTree as ET

        # Find the last watched movie from the Films library, sorted by
        # lastViewedAt. This is the item-level "watched" date, so it also
        # covers movies marked as watched (or played without a scrobbled
        # session) — which never appear in /status/sessions/history/all.
        section_key = find_plex_section(ET, "movie")
        if section_key is None:
            return jsonify({"text": None, "movie": None})

        url = (
            f"{PLEX_URL}/library/sections/{section_key}/all"
            f"?X-Plex-Token={PLEX_TOKEN}&type=1&sort=lastViewedAt:desc"
            f"&viewCount%3E=1&X-Plex-Container-Size=1"
        )
        req = urllib.request.Request(url, headers={"Accept": "application/xml"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            tree = ET.parse(resp)

        # Container-Size is best-effort on this endpoint, so take the first
        # movie entry (already sorted most-recently-viewed first).
        last_watched = tree.getroot().find("Video")
        if last_watched is None:
            return jsonify({"text": None, "movie": None})

        movie_title = last_watched.get("title")
        movie_year = last_watched.get("year", "")
        # The section listing carries Director tags directly — no extra fetch.
        directors = [d.get("tag") for d in last_watched.findall("Director")]

        movie_key = f"{movie_title} ({movie_year})"

        # Return cache if same movie and not expired
        cache_age = time.time() - _trivia_cache["generated_at"]
        if _trivia_cache["movie"] == movie_key and _trivia_cache["text"] and cache_age < TRIVIA_TTL:
            return jsonify({
                "text": _trivia_cache["text"],
                "movie": _trivia_cache["movie"],
            })

        # Rate-limit: don't retry Gemini too soon after an error
        if time.time() < _trivia_cache["error_until"]:
            return jsonify({"text": None, "movie": movie_key})

        # Call Gemini API
        director_hint = f", réalisé par {', '.join(directors)}" if directors else ""
        prompt = (
            f"Recherche les \"secrets de tournage\" et \"trivia\" du film \"{movie_title}\" ({movie_year}{director_hint}). "
            f"Cherche en priorité sur allocine.fr (section secrets de tournage), puis imdb.com (trivia), puis wikipedia. "
            f"Extrais uniquement des faits sourcés et vérifiables trouvés sur ces sites. "
            f"Ne génère AUCUNE information de toi-même. Si tu ne trouves rien, réponds juste \"Aucune anecdote trouvée\". "
            f"Privilégie les vraies anecdotes de coulisses : lieux de tournage insolites, caméos cachés, accidents sur le plateau, "
            f"entraînements ou régimes hors-norme des acteurs, improvisations, scènes coupées marquantes, clins d'œil cachés. "
            f"ÉVITE les données purement factuelles comme le budget, le box-office, la durée du film, les dates de sortie ou le résumé du scénario. "
            f"FORMAT OBLIGATOIRE : une seule ligne, chaque anecdote DOIT être séparée par le caractère ★. "
            f"Exemple de format attendu : \"Première anecdote ici ★ Deuxième anecdote ici ★ Troisième anecdote ici\" "
            f"Ton : conversationnel et concis, pas de superlatifs ni d'exclamations. En français. "
            f"Pas de titre, pas de préambule, pas de numérotation, pas de liens, pas d'URLs, juste du texte. "
            f"Commence directement par la première anecdote."
        )

        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        body = jsonlib.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "tools": [{"google_search": {}}],
        })
        req = urllib.request.Request(
            gemini_url,
            data=body.encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = jsonlib.loads(resp.read())

        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()

        # Update cache
        _trivia_cache["movie"] = movie_key
        _trivia_cache["text"] = text
        _trivia_cache["error_until"] = 0
        _trivia_cache["generated_at"] = time.time()

        return jsonify({"text": text, "movie": movie_key})

    except Exception as e:
        _trivia_cache["error_until"] = time.time() + GEMINI_COOLDOWN
        return jsonify({"error": str(e)}), 500


# ========================
#  Sorties (Nantes Métropole open data)
# ========================

NANTES_EVENTS_URL = (
    "https://data.nantesmetropole.fr/api/explore/v2.1/catalog/datasets/"
    "244400404_agenda-evenements-nantes-metropole_v2/records"
)
NANTES_PAGE_SIZE = 100
NANTES_MAX_PAGES = 20
PARIS_TZ = ZoneInfo("Europe/Paris")
SORTIES_TTL = 30 * 60  # the open data agenda changes at most a few times a day

_sorties_cache = {"key": None, "payload": None, "fetched_at": 0}


def next_weekend(today):
    """Saturday/Sunday of the upcoming weekend.

    On a Saturday or Sunday the current weekend is still "le week-end" —
    only days already past are dropped later by the caller.
    """
    weekday = today.weekday()  # Monday = 0, Saturday = 5, Sunday = 6
    if weekday == 6:
        saturday = today - timedelta(days=1)
    else:
        saturday = today + timedelta(days=5 - weekday)
    return saturday, saturday + timedelta(days=1)


def fetch_nantes_records(date_from, date_to):
    where = urllib.parse.quote(
        f'date>="{date_from}" AND date<="{date_to}" AND annule="non"'
    )
    records = []
    offset = 0

    for _ in range(NANTES_MAX_PAGES):
        url = (
            f"{NANTES_EVENTS_URL}?limit={NANTES_PAGE_SIZE}&offset={offset}"
            f"&where={where}&order_by=date%20ASC"
        )
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            page = jsonlib.loads(resp.read()).get("results", [])

        records.extend(page)
        if len(page) < NANTES_PAGE_SIZE:
            break
        offset += NANTES_PAGE_SIZE

    return records


def clean_html(text):
    if not text:
        return None
    stripped = re.sub(r"<[^>]*>", " ", text)
    stripped = re.sub(r"\s+", " ", stripped).strip()
    return stripped or None


def parse_nantes_event(record):
    """One agenda record = one occurrence on one day."""
    date = record.get("date")
    if not date or record.get("reporte") == "oui":
        return None

    start = record.get("heure_debut") or None
    end = record.get("heure_fin") or None
    # The agenda encodes an all-day event as a missing start time, or as
    # "00:00" with either no end time or one running to the end of the day.
    all_day = not start or (start == "00:00" and (not end or end >= "23:00"))

    place = [record.get("lieu"), record.get("ville")]
    address = record.get("adresse")

    return {
        "id": f"{record.get('id_manif')}_{date}_{start or 'allday'}",
        "title": record.get("nom") or "Sans titre",
        "date": date,
        "start": None if all_day else start,
        "end": None if all_day else end,
        "allDay": all_day,
        "place": " · ".join(p for p in place if p and p != ".") or None,
        "address": address if address and address != "." else None,
        "city": record.get("ville"),
        "description": clean_html(record.get("description_evt") or record.get("description")),
        "categories": record.get("types_libelles") or [],
        "themes": record.get("themes_libelles") or [],
        "free": record.get("gratuit") == "oui",
        "price": clean_html(record.get("precisions_tarifs_evt")),
        "audience": record.get("precisions_public"),
        "organizer": record.get("emetteur"),
        "image": record.get("media_url"),
        "url": record.get("lien_agenda") or record.get("url_site"),
    }


@app.route("/api/sorties")
def sorties():
    import time

    today = datetime.now(PARIS_TZ).date()
    saturday, sunday = next_weekend(today)
    # On a Saturday or Sunday, drop the day that has already gone by.
    date_from = max(saturday, today)

    cache_key = date_from.isoformat()
    if (
        _sorties_cache["key"] == cache_key
        and time.time() - _sorties_cache["fetched_at"] < SORTIES_TTL
    ):
        return jsonify(_sorties_cache["payload"])

    try:
        records = fetch_nantes_records(date_from.isoformat(), sunday.isoformat())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    events = []
    seen = set()
    for record in records:
        event = parse_nantes_event(record)
        if event is None or event["id"] in seen:
            continue
        seen.add(event["id"])
        events.append(event)

    # Timed events first, in chronological order; all-day ones close the day.
    events.sort(key=lambda e: (e["date"], e["allDay"], e["start"] or "", e["title"]))

    payload = {
        "events": events,
        "days": [d.isoformat() for d in (saturday, sunday) if d >= today],
    }
    _sorties_cache.update({"key": cache_key, "payload": payload, "fetched_at": time.time()})

    return jsonify(payload)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5100)
