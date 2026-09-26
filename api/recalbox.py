"""Basic health of a Recalbox on the LAN: its web API (port 81) and the retained SystemInfo on its MQTT broker."""
import json
import os
import socket
import struct
import threading
import time
import urllib.request

from flask import Blueprint, jsonify

bp = Blueprint("recalbox", __name__)

RECALBOX_HOST = os.environ.get("RECALBOX_HOST", "").strip()  # empty = feature off, card hidden
REFRESH_SECONDS = 60
STALE_SECONDS = 15 * 60  # older readings are dropped rather than shown as current
# On Wi-Fi the box can take several seconds to wake up, so it is polled in the background and a request
# never waits on it. Per gunicorn worker.
_state = {"online": None, "version": None, "storage": None, "system": None, "system_at": 0.0, "checked_at": 0.0}
_lock = threading.Lock()
_thread = None


def api_get(path):
    with urllib.request.urlopen(f"http://{RECALBOX_HOST}:81/api{path}", timeout=12) as r:
        return json.loads(r.read())


def _mqtt_str(s):
    b = s.encode()
    return struct.pack("!H", len(b)) + b


def _mqtt_len(n):
    out = b""
    while True:
        digit, n = n % 128, n // 128
        out += bytes([digit | (0x80 if n else 0)])
        if not n:
            return out


def system_info(timeout=3):
    """Read the retained 'Recalbox/WebAPI/SystemInfo' message (CPU, memory, temperature).

    A minimal MQTT 3.1.1 subscriber, so the API needs no extra dependency. Read-only: it never publishes.
    """
    topic = "Recalbox/WebAPI/SystemInfo"
    with socket.create_connection((RECALBOX_HOST, 1883), timeout=timeout) as s:
        connect = _mqtt_str("MQTT") + bytes([4, 2]) + struct.pack("!H", 30) + _mqtt_str(f"dashboard-{os.getpid()}")
        s.sendall(bytes([0x10]) + _mqtt_len(len(connect)) + connect)
        ack = s.recv(4)
        if len(ack) < 4 or ack[3] != 0:
            raise ConnectionError("MQTT connection refused")
        sub = struct.pack("!H", 1) + _mqtt_str(topic) + bytes([0])
        s.sendall(bytes([0x82]) + _mqtt_len(len(sub)) + sub)

        buf, deadline = b"", time.time() + timeout
        while time.time() < deadline:
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
            while len(buf) >= 2:  # parse whole packets
                mult, length, i = 1, 0, 1
                while i < len(buf):
                    length += (buf[i] & 127) * mult
                    mult *= 128
                    i += 1
                    if not buf[i - 1] & 128:
                        break
                else:
                    break
                if len(buf) < i + length:
                    break
                kind, body, buf = buf[0] >> 4, buf[i:i + length], buf[i + length:]
                if kind == 3:  # PUBLISH (QoS 0)
                    name_len = struct.unpack("!H", body[:2])[0]
                    if body[2:2 + name_len].decode(errors="ignore") == topic:
                        s.sendall(bytes([0xE0, 0]))  # DISCONNECT
                        return json.loads(body[2 + name_len:])
    raise TimeoutError("no SystemInfo received")


def first(value):
    return value[0] if isinstance(value, list) and value else value


def parse_system_info(info):
    out = {"cpu": None, "memory": None, "temperature": None}
    loads = [first(c.get("consumption")) for c in (info.get("cpus") or {}).values()]
    loads = [x for x in loads if isinstance(x, (int, float))]
    if loads:
        out["cpu"] = round(sum(loads) / len(loads), 1)
    memory = info.get("memory") or {}
    total, available = memory.get("total"), first(memory.get("available"))
    if total and available is not None:
        out["memory"] = {"total": total, "used": total - available, "percent": round(100 * (total - available) / total, 1)}
    temp = first((info.get("temperature") or {}).get("temperatures"))
    if isinstance(temp, (int, float)):
        out["temperature"] = round(temp)
    return out


def refresh():
    """One polling round. Each source is optional: what fails keeps its last known value."""
    update = {"checked_at": time.time()}
    try:
        update["version"] = (api_get("/versions").get("recalbox") or "").strip() or None
        update["online"] = True
        shares = [s for s in api_get("/monitoring/storageinfo").get("storages", {}).values() if s.get("recalbox") == "share"]
        if shares:  # several mounts point at the games partition: keep the biggest one
            share = max(shares, key=lambda s: s.get("size", 0))
            update["storage"] = {"total": share["size"], "free": max(0, share["size"] - share["used"])}
    except Exception:
        update["online"] = False

    try:
        update["system"] = parse_system_info(system_info())
        update["system_at"] = time.time()
        update["online"] = True
    except Exception:
        pass

    with _lock:
        _state.update(update)


def _loop():
    while True:
        refresh()
        time.sleep(REFRESH_SECONDS)


def snapshot():
    global _thread
    with _lock:
        if _thread is None:
            _thread = threading.Thread(target=_loop, daemon=True, name="recalbox-poller")
            _thread.start()
        state = dict(_state)
    system = state["system"] if time.time() - state["system_at"] < STALE_SECONDS else None
    return {
        "online": state["online"],  # None = first check still running
        "version": state["version"],
        "storage": state["storage"],
        **(system or {"cpu": None, "memory": None, "temperature": None}),
    }


@bp.route("/api/recalbox")
def recalbox_status():
    if not RECALBOX_HOST:
        return jsonify({"configured": False})
    return jsonify({"configured": True, **snapshot()})
