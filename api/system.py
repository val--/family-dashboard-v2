"""Host metrics for the "Serveur" card: CPU, memory, temperature, network rate, disks."""
import glob
import os
import time
from concurrent.futures import ThreadPoolExecutor

from flask import Blueprint, jsonify

bp = Blueprint("system", __name__)

# "Label:path" pairs, ";" separated. Paths are the container's view: "/" is the host root
# filesystem, the host's /mnt is mounted read-only under /host/mnt (see docker-compose.yml)
SYSTEM_DISKS = os.environ.get("SYSTEM_DISKS", "Système:/")
# Host NIC counters (the container's own /sys only has its private eth0)
SYSTEM_NET_STATS_DIR = os.environ.get("SYSTEM_NET_STATS_DIR", "/host/net")

_samples = {}  # key -> (timestamp, reading), per gunicorn worker; used to compute rates
_disk_pool = ThreadPoolExecutor(max_workers=4)
_disk_cache = {"at": 0.0, "value": []}
DISK_CACHE_SECONDS = 60


def take_baselines(readers, max_age=120):
    """Make sure each reader has a recent previous reading to compute a rate against.

    After a restart (or a long pause) there is none: take one now and wait a short moment,
    once for all readers, so the first call still gets values.
    """
    stale = [k for k in readers if k not in _samples or time.time() - _samples[k][0] > max_age]
    for key in stale:
        try:
            _samples[key] = (time.time(), readers[key]())
        except OSError:
            _samples.pop(key, None)
    if stale:
        time.sleep(0.25)


def sampled(key, read):
    """(previous reading, current reading, seconds between them); needs take_baselines first."""
    prev = _samples[key]
    now, cur = time.time(), read()
    _samples[key] = (now, cur)
    return prev[1], cur, max(now - prev[0], 0.001)


def read_cpu_times():
    with open("/proc/stat") as f:
        fields = [int(x) for x in f.readline().split()[1:9]]
    return sum(fields), fields[3] + fields[4]  # total, idle + iowait


def read_meminfo():
    info = {}
    with open("/proc/meminfo") as f:
        for line in f:
            key, _, rest = line.partition(":")
            info[key] = int(rest.split()[0]) * 1024
    return info


def read_temperature():
    temps = []
    for path in glob.glob("/sys/class/thermal/thermal_zone*/temp"):
        try:
            with open(path) as f:
                temps.append(int(f.read()) / 1000)
        except (OSError, ValueError):
            continue
    return round(max(temps)) if temps else None


def read_net_bytes():
    def counter(name):
        with open(os.path.join(SYSTEM_NET_STATS_DIR, name)) as f:
            return int(f.read())
    return counter("rx_bytes"), counter("tx_bytes")


def disk_usage(path):
    st = os.statvfs(path)
    return st.f_blocks * st.f_frsize, st.f_bavail * st.f_frsize


def read_disks():
    # NFS mounts can hang when the NAS is down: bound each lookup and cache the answer
    if time.time() - _disk_cache["at"] < DISK_CACHE_SECONDS:
        return _disk_cache["value"]

    disks = []
    for entry in SYSTEM_DISKS.split(";"):
        name, _, path = entry.partition(":")
        if not name.strip() or not path.strip():
            continue
        try:
            total, free = _disk_pool.submit(disk_usage, path.strip()).result(timeout=3)
        except Exception:
            continue
        disks.append({"name": name.strip(), "total": total, "free": free})

    _disk_cache.update(at=time.time(), value=disks)
    return disks


@bp.route("/api/system")
def system_status():
    take_baselines({"cpu": read_cpu_times, "net": read_net_bytes})

    prev, cur, _ = sampled("cpu", read_cpu_times)
    d_total, d_idle = cur[0] - prev[0], cur[1] - prev[1]
    cpu = round(100 * (1 - d_idle / d_total), 1) if d_total > 0 else 0.0

    mem = read_meminfo()
    mem_used = mem["MemTotal"] - mem["MemAvailable"]

    network = None
    try:
        prev, cur, seconds = sampled("net", read_net_bytes)
        network = {
            "down": max(0, round((cur[0] - prev[0]) / seconds)),
            "up": max(0, round((cur[1] - prev[1]) / seconds)),
        }
    except (OSError, KeyError):
        pass

    with open("/proc/uptime") as f:
        uptime = int(float(f.read().split()[0]))
    with open("/proc/loadavg") as f:
        load = float(f.read().split()[0])

    return jsonify({
        "cpu": cpu,
        "cores": os.cpu_count(),
        "load": load,
        "memory": {
            "total": mem["MemTotal"],
            "used": mem_used,
            "percent": round(100 * mem_used / mem["MemTotal"], 1),
        },
        "temperature": read_temperature(),
        "uptime": uptime,
        "network": network,
        "disks": read_disks(),
    })
