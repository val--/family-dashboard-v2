import subprocess
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

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


def get_ink_levels():
    """Try to read marker-levels from CUPS via pycups."""
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5100)
