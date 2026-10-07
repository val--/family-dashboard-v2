"""Philips Hue lights: the rooms, their lights and their scenes, through the bridge's local API (CLIP v2).

The kiosk can switch a light or a whole room, set a room's brightness, and recall a scene; nothing else
(no renaming, no deleting, no settings). Off when HUE_BRIDGE_IP / HUE_APP_KEY are not set.
"""
import json
import math
import os
import re
import ssl
import threading
import time
import urllib.error
import urllib.request

from flask import Blueprint, jsonify, request

bp = Blueprint("hue", __name__)

HUE_BRIDGE_IP = os.environ.get("HUE_BRIDGE_IP", "").strip()
HUE_APP_KEY = os.environ.get("HUE_APP_KEY", "").strip()
TIMEOUT = 5
CACHE_SECONDS = 2  # a burst of taps reads the bridge once
RESOURCE_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

# The bridge serves HTTPS with its own self-signed certificate (no public CA can vouch for a LAN address):
# no certificate check, it is only ever reached on the home network.
_tls = ssl.create_default_context()
_tls.check_hostname = False
_tls.verify_mode = ssl.CERT_NONE

_cache = {"at": 0.0, "state": None}
_cache_lock = threading.Lock()


class HueError(Exception):
    pass


def _call(method, resource, body=None):
    """One request to the bridge; returns its `data` list. Raises HueError with the bridge's own words."""
    req = urllib.request.Request(
        f"https://{HUE_BRIDGE_IP}/clip/v2/resource/{resource}",
        method=method,
        headers={"hue-application-key": HUE_APP_KEY, "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    try:
        with urllib.request.urlopen(req, context=_tls, timeout=TIMEOUT) as resp:
            return json.load(resp).get("data", [])
    except urllib.error.HTTPError as e:
        try:
            errors = json.load(e).get("errors", [])
            detail = ", ".join(err.get("description", "") for err in errors) or str(e)
        except ValueError:
            detail = str(e)
        raise HueError(detail) from None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise HueError(f"pont Hue injoignable ({getattr(e, 'reason', e)})") from None


# ---- Colors, as the kiosk shows them (a lamp's dot, a scene's palette)


def xy_to_hex(x, y):
    """CIE xy (what Hue lamps speak) to an sRGB color at full brightness."""
    if y <= 0:
        return "#ffffff"
    X, Y, Z = x / y, 1.0, (1 - x - y) / y
    rgb = [
        X * 3.2404542 - Y * 1.5371385 - Z * 0.4985314,
        -X * 0.9692660 + Y * 1.8760108 + Z * 0.0415560,
        X * 0.0556434 - Y * 0.2040259 + Z * 1.0572252,
    ]
    rgb = [max(0.0, c) for c in rgb]
    top = max(rgb) or 1.0
    rgb = [c / top for c in rgb]  # the hue of the light, as bright as a screen can show it
    rgb = [12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055 for c in rgb]
    return "#" + "".join(f"{round(max(0.0, min(1.0, c)) * 255):02x}" for c in rgb)


def mirek_to_hex(mirek):
    """A white's temperature (mirek = 1e6 / kelvin) to the color it looks like on screen (Tanner Helland's fit)."""
    t = 1_000_000 / max(153, min(500, mirek)) / 100
    red = 255 if t <= 66 else 329.698727446 * (t - 60) ** -0.1332047592
    green = 99.4708025861 * math.log(t) - 161.1195681661 if t <= 66 else 288.1221695283 * (t - 60) ** -0.0755148492
    blue = 255 if t >= 66 else 0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307
    return "#" + "".join(f"{round(max(0, min(255, c))):02x}" for c in (red, green, blue))


def light_color(light):
    """The color a lamp gives right now (None when off)."""
    if not light.get("on", {}).get("on"):
        return None
    temperature = light.get("color_temperature") or {}
    if temperature.get("mirek_valid") and temperature.get("mirek"):
        return mirek_to_hex(temperature["mirek"])
    xy = (light.get("color") or {}).get("xy")
    if xy:
        return xy_to_hex(xy["x"], xy["y"])
    return "#fff4e0"  # a white-only bulb


def scene_colors(scene, limit=5):
    """The few colors that sum a scene up: its palette, else what its lamps are told to do."""
    palette = scene.get("palette") or {}
    colors = [xy_to_hex(c["color"]["xy"]["x"], c["color"]["xy"]["y"]) for c in palette.get("color", []) if c.get("color")]
    colors += [mirek_to_hex(c["color_temperature"]["mirek"]) for c in palette.get("color_temperature", [])
               if c.get("color_temperature", {}).get("mirek")]
    if not colors:
        for action in scene.get("actions", []):
            act = action.get("action", {})
            if act.get("color", {}).get("xy"):
                colors.append(xy_to_hex(act["color"]["xy"]["x"], act["color"]["xy"]["y"]))
            elif act.get("color_temperature", {}).get("mirek"):
                colors.append(mirek_to_hex(act["color_temperature"]["mirek"]))
    unique = list(dict.fromkeys(colors))
    return unique[:limit] or ["#fff4e0"]


# ---- What the kiosk shows


def build_state(rooms, devices, lights, grouped_lights, scenes, homes=()):
    """Rooms (most lights first), each with its lights and its scenes, from the bridge's resources; and the
    whole home's group (every light of the bridge), for "Tout éteindre"."""
    light_by_id = {light["id"]: light for light in lights}
    group_by_id = {group["id"]: group for group in grouped_lights}
    device_lights = {
        device["id"]: [s["rid"] for s in device.get("services", []) if s.get("rtype") == "light"] for device in devices
    }
    out = []
    for room in rooms:
        light_ids = [lid for child in room.get("children", []) if child.get("rtype") == "device"
                     for lid in device_lights.get(child["rid"], [])]
        room_lights = [light_by_id[lid] for lid in light_ids if lid in light_by_id]
        group_id = next((s["rid"] for s in room.get("services", []) if s.get("rtype") == "grouped_light"), None)
        group = group_by_id.get(group_id, {})
        room_scenes = [s for s in scenes if s.get("group", {}).get("rid") == room["id"]]
        out.append({
            "id": room["id"],
            "name": room.get("metadata", {}).get("name", "Pièce"),
            "group": group_id,
            "on": bool(group.get("on", {}).get("on")),
            "brightness": round(group.get("dimming", {}).get("brightness") or 0),
            "lights": sorted(
                [{
                    "id": light["id"],
                    "name": light.get("metadata", {}).get("name", "Lumière"),
                    "on": bool(light.get("on", {}).get("on")),
                    "brightness": round((light.get("dimming") or {}).get("brightness") or 0),
                    "color": light_color(light),
                } for light in room_lights],
                key=lambda light: light["name"].lower(),
            ),
            "scenes": sorted(
                [{
                    "id": scene["id"],
                    "name": scene.get("metadata", {}).get("name", "Scénario"),
                    "colors": scene_colors(scene),
                    "active": scene.get("status", {}).get("active", "inactive") != "inactive",
                } for scene in room_scenes],
                key=lambda scene: scene["name"].lower(),
            ),
        })
    out.sort(key=lambda room: (-len(room["lights"]), room["name"].lower()))
    home_group = next((s["rid"] for home in homes for s in home.get("services", []) if s.get("rtype") == "grouped_light"), None)
    home = {"group": home_group, "on": bool(group_by_id.get(home_group, {}).get("on", {}).get("on"))} if home_group else None
    return {"rooms": out, "home": home}


def current_state():
    with _cache_lock:
        if _cache["state"] is not None and time.time() - _cache["at"] < CACHE_SECONDS:
            return _cache["state"]
    state = build_state(*(_call("GET", name) for name in ("room", "device", "light", "grouped_light", "scene", "bridge_home")))
    with _cache_lock:
        _cache.update(at=time.time(), state=state)
    return state


def _forget():
    with _cache_lock:
        _cache["state"] = None


# ---- Routes


def _configured():
    return bool(HUE_BRIDGE_IP and HUE_APP_KEY)


def _changes():
    """{on, brightness} from the request, checked: on is a boolean, brightness 1 to 100."""
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return None, "Corps JSON attendu"
    changes = {}
    if "on" in body:
        if not isinstance(body["on"], bool):
            return None, "on doit valoir true ou false"
        changes["on"] = {"on": body["on"]}
    if "brightness" in body:
        value = body["brightness"]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not 1 <= value <= 100:
            return None, "brightness doit être entre 1 et 100"
        changes["dimming"] = {"brightness": float(value)}
    if not changes:
        return None, "Rien à changer (on, brightness)"
    return changes, None


def _apply(resource, resource_id):
    if not _configured():
        return jsonify({"error": "Hue n'est pas configuré"}), 503
    if not RESOURCE_ID.match(resource_id):
        return jsonify({"error": "Identifiant invalide"}), 400
    changes, problem = _changes()
    if problem:
        return jsonify({"error": problem}), 400
    try:
        _call("PUT", f"{resource}/{resource_id}", changes)
    except HueError as e:
        return jsonify({"error": str(e)}), 502
    _forget()
    return jsonify({"ok": True})


@bp.route("/api/hue")
def hue_state():
    if not _configured():
        return jsonify({"error": "Hue n'est pas configuré"}), 503
    try:
        return jsonify(current_state())
    except HueError as e:
        return jsonify({"error": str(e)}), 502


@bp.route("/api/hue/lights/<light_id>", methods=["PUT"])
def set_light(light_id):
    return _apply("light", light_id)


@bp.route("/api/hue/groups/<group_id>", methods=["PUT"])
def set_group(group_id):
    """A room's lights all at once (its grouped_light)."""
    return _apply("grouped_light", group_id)


@bp.route("/api/hue/scenes/<scene_id>/recall", methods=["POST"])
def recall_scene(scene_id):
    if not _configured():
        return jsonify({"error": "Hue n'est pas configuré"}), 503
    if not RESOURCE_ID.match(scene_id):
        return jsonify({"error": "Identifiant invalide"}), 400
    try:
        _call("PUT", f"scene/{scene_id}", {"recall": {"action": "active"}})
    except HueError as e:
        return jsonify({"error": str(e)}), 502
    _forget()
    return jsonify({"ok": True})
