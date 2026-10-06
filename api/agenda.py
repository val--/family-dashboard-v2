"""Family agenda: upcoming events of a Google Calendar (service account), cached."""
import os
import time
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify

bp = Blueprint("agenda", __name__)

# -- Calendar config --
CALENDAR_ID = os.environ.get("CALENDAR_ID", "")
CREDENTIALS_PATH = os.environ.get("CREDENTIALS_PATH", "/app/credentials/service-account.json")

GOOGLE_TIMEOUT = 10  # seconds, for every connection to Google (token refresh included)
CALENDAR_CACHE_SECONDS = 5 * 60
_calendar_cache = {"at": 0.0, "events": None}


def get_calendar_service():
    import google_auth_httplib2
    import httplib2
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    credentials = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH,
        scopes=["https://www.googleapis.com/auth/calendar.readonly"],
    )
    # Without an explicit timeout httplib2 can wait forever on a stalled connection, until gunicorn kills
    # the worker. The authorized http is what the client uses for the token refresh too.
    http = google_auth_httplib2.AuthorizedHttp(credentials, http=httplib2.Http(timeout=GOOGLE_TIMEOUT))
    return build("calendar", "v3", http=http, cache_discovery=False)


def fetch_calendar_events():
    service = get_calendar_service()
    now = datetime.now(timezone.utc)
    result = service.events().list(
        calendarId=CALENDAR_ID,
        timeMin=now.isoformat(),
        timeMax=(now + timedelta(days=365)).isoformat(),
        singleEvents=True,
        orderBy="startTime",
        maxResults=250,
    ).execute(num_retries=1)

    events = []
    for item in result.get("items", []):
        events.append({
            "title": item.get("summary", "Sans titre"),
            "start": item["start"].get("dateTime", item["start"].get("date", "")),
            "end": item["end"].get("dateTime", item["end"].get("date", "")),
            "allDay": "date" in item["start"],
            "location": item.get("location"),
        })
    return events


@bp.route("/api/calendar")
def calendar_events():
    if not CALENDAR_ID:
        return jsonify({"error": "CALENDAR_ID not configured"}), 500

    # Recent answer: no call to Google at all
    if _calendar_cache["events"] is not None and time.time() - _calendar_cache["at"] < CALENDAR_CACHE_SECONDS:
        return jsonify({"events": _calendar_cache["events"]})

    try:
        events = fetch_calendar_events()
        _calendar_cache.update(at=time.time(), events=events)
        return jsonify({"events": events})
    except FileNotFoundError:
        return jsonify({"error": "Service account credentials not found"}), 500
    except Exception as e:
        # Google slow or unreachable: keep showing the last known events rather than an empty agenda
        if _calendar_cache["events"] is not None:
            return jsonify({"events": _calendar_cache["events"], "stale": True})
        return jsonify({"error": str(e)}), 500
