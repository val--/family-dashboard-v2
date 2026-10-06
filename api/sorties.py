"""Weekend outings in Nantes (Nantes Métropole open data agenda). The widget is hidden for now."""
import json as jsonlib
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from flask import Blueprint, jsonify

bp = Blueprint("sorties", __name__)

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
        with urllib.request.urlopen(req, timeout=20) as resp:  # below gunicorn's 30 s
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


@bp.route("/api/sorties")
def sorties():
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
