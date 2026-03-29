import os
import subprocess
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
PLEX_TOKEN = os.environ.get("PLEX_TOKEN", "")

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


def get_ink_levels():
    try:
        import cups
        conn = cups.Connection()
        attrs = conn.getPrinterAttributes(PRINTER_NAME)
        levels = attrs.get("marker-levels")
        names = attrs.get("marker-names")
        colors = attrs.get("marker-colors")
        if levels and names:
            return [
                {"name": n, "level": l, "color": c}
                for n, l, c in zip(names, levels, colors or [""] * len(names))
            ]
    except Exception:
        pass
    return None


@app.route("/api/printer")
def printer_status():
    connected = is_usb_connected()
    status = get_cups_status() if connected else "offline"
    ink = get_ink_levels() if connected else None

    return jsonify({
        "name": PRINTER_NAME,
        "connected": connected,
        "status": status,
        "ink": ink,
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
            movies.append({
                "title": item.get("title"),
                "year": item.get("year"),
                "addedAt": item.get("addedAt"),
                "thumb": item.get("thumb"),
                "watched": int(item.get("viewCount", 0)) > 0,
            })
            if len(movies) >= 3:
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
            last_viewed = item.get("lastViewedAt")
            if not last_viewed:
                return jsonify(None)
            return jsonify({
                "title": item.get("title"),
                "year": item.get("year"),
                "lastViewedAt": last_viewed,
                "thumb": item.get("thumb"),
            })

        return jsonify(None)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/plex/thumb")
def plex_thumb():
    path = request.args.get("path", "")
    if not PLEX_TOKEN or not path:
        return "", 404

    try:
        import urllib.request

        url = f"{PLEX_URL}{path}?X-Plex-Token={PLEX_TOKEN}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
            content_type = resp.headers.get("Content-Type", "image/jpeg")
            return data, 200, {"Content-Type": content_type, "Cache-Control": "public, max-age=86400"}
    except Exception:
        return "", 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5100)
