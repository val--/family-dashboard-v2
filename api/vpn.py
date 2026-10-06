"""VPN status: the gluetun container (read through the Docker socket) and where its exit IP is."""
import json as jsonlib
import re
import urllib.request

from flask import Blueprint, jsonify

bp = Blueprint("vpn", __name__)

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


@bp.route("/api/vpn")
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
