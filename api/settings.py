"""Dashboard settings, changed from the kiosk's Settings screen and kept in data/settings.json.

Only known keys with allowed values are accepted (the endpoint is open on the LAN).
"""
import json
import os
import threading

from flask import Blueprint, jsonify, request

bp = Blueprint("settings", __name__)

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")

# key -> (default, allowed values)
SCHEMA = {
    "idleMinutes": (5, [1, 5, 15, 60, 0]),  # screensaver delay; 0 = never
}

_lock = threading.Lock()


def load():
    try:
        with open(SETTINGS_FILE) as f:
            stored = json.load(f)
    except (OSError, ValueError):
        stored = {}
    return {key: stored.get(key, default) if stored.get(key, default) in allowed else default
            for key, (default, allowed) in SCHEMA.items()}


@bp.route("/api/settings")
def get_settings():
    return jsonify(load())


@bp.route("/api/settings", methods=["PUT"])
def update_settings():
    changes = request.get_json(silent=True) or {}
    unknown = [key for key in changes if key not in SCHEMA]
    # bool is an int in Python (True == 1): refuse it explicitly
    invalid = [key for key, value in changes.items()
               if key in SCHEMA and (isinstance(value, bool) or value not in SCHEMA[key][1])]
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
