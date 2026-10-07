"""Dashboard settings, changed from the kiosk's Settings screen and kept in data/settings.json.

Only known keys with allowed values are accepted (the endpoint is open on the LAN).
"""
import json
import os
import re
import threading

from flask import Blueprint, jsonify, request

bp = Blueprint("settings", __name__)

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")

HUE_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
MAX_LIGHT_SHORTCUTS = 3


def _light_shortcuts(value):
    """Up to 3 Hue scene ids, all different (the screensaver's light shortcuts, in this order)."""
    return (isinstance(value, list) and len(value) <= MAX_LIGHT_SHORTCUTS and len(set(value)) == len(value)
            and all(isinstance(v, str) and HUE_ID.match(v) for v in value))


# key -> (default, allowed values or a check)
SCHEMA = {
    "idleMinutes": (5, [1, 5, 15, 60, 0]),  # screensaver delay; 0 = never
    "postitSeconds": (30, [15, 30, 60, 300, 0]),  # time per post-it on the screensaver (latest: twice as long); 0 = stays
    "postitRange": ("today", ["today", "3days", "all"]),  # which post-its go round on the screensaver
    "movieDays": (3, [1, 3, 7, 14, 0]),  # movies added to Plex this recently go round on the screensaver too; 0 = none
    "lightShortcuts": ([], _light_shortcuts),  # Hue scenes offered on the screensaver
}


def _allowed(key, value):
    _, check = SCHEMA[key]
    if callable(check):
        return check(value)
    return not isinstance(value, bool) and value in check  # bool is an int in Python (True == 1): refused

_lock = threading.Lock()


def load():
    try:
        with open(SETTINGS_FILE) as f:
            stored = json.load(f)
    except (OSError, ValueError):
        stored = {}
    return {key: stored[key] if key in stored and _allowed(key, stored[key]) else default
            for key, (default, _) in SCHEMA.items()}


@bp.route("/api/settings")
def get_settings():
    return jsonify(load())


@bp.route("/api/settings", methods=["PUT"])
def update_settings():
    changes = request.get_json(silent=True) or {}
    unknown = [key for key in changes if key not in SCHEMA]
    invalid = [key for key, value in changes.items() if key in SCHEMA and not _allowed(key, value)]
    if unknown or invalid:
        return jsonify({"error": f"Paramètre inconnu ou valeur non autorisée: {', '.join(unknown + invalid)}"}), 400
    with _lock:
        settings = {**load(), **changes}
        os.makedirs(DATA_DIR, exist_ok=True)
        tmp = f"{SETTINGS_FILE}.{os.getpid()}.tmp"
        with open(tmp, "w") as f:
            json.dump(settings, f, indent=2)
        os.replace(tmp, SETTINGS_FILE)
    return jsonify(settings)
