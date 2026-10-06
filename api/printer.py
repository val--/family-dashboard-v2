"""USB printer (HP DeskJet) through the host CUPS: status, and a test page from the kiosk."""
import os
import subprocess
import time

from flask import Blueprint, jsonify

bp = Blueprint("printer", __name__)

# -- Printer config --
PRINTER_NAME = "Deskjet_3630"
USB_ID = "03f0:e311"

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


@bp.route("/api/printer")
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


@bp.route("/api/printer/test", methods=["POST"])
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
