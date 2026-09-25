"""Family post-it board: notes written from phones on the LAN, shown on the kiosk."""
import hmac
import os
import sqlite3
import time

from flask import Blueprint, jsonify, request

bp = Blueprint("postits", __name__)

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "postits.db")

FAMILY_CODE = os.environ.get("FAMILY_CODE", "").strip()  # empty = no code required
MEMBERS = [m.strip() for m in os.environ.get("FAMILY_MEMBERS", "").split(",") if m.strip()]


def _int_env(name, default):
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


RETENTION_DAYS = _int_env("POSTIT_DAYS", 7)
MAX_CHARS = 200
COLORS = ["yellow", "pink", "blue", "green", "orange", "purple"]
STICKERS = ["heart", "star", "smile", "sun", "music", "coffee", "pizza", "cat", "gift", "party", "book", "ball"]

POST_COOLDOWN = 5  # seconds between two notes from the same device
MAX_FAILURES = 5  # wrong family codes allowed per device...
FAILURE_WINDOW = 300  # ...within this many seconds

# Per gunicorn worker: cheap protection, not a security boundary
_last_post = {}
_failures = {}
_ready = False


def db():
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_db():
    global _ready
    if _ready:
        return
    os.makedirs(DATA_DIR, exist_ok=True)
    with db() as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS notes (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   author TEXT NOT NULL,
                   text TEXT NOT NULL,
                   color TEXT NOT NULL,
                   sticker TEXT,
                   created_at INTEGER NOT NULL,
                   pinned INTEGER NOT NULL DEFAULT 0
               )"""
        )
    _ready = True


@bp.before_request
def _prepare():
    try:
        ensure_db()
    except Exception as e:  # unwritable data dir, etc.: fail this feature, not the whole API
        return jsonify({"error": f"post-it storage unavailable: {e}"}), 503


def note_dict(row):
    return {
        "id": row["id"],
        "author": row["author"],
        "text": row["text"],
        "color": row["color"],
        "sticker": row["sticker"],
        "createdAt": row["created_at"],
        "pinned": bool(row["pinned"]),
    }


def purge_expired(conn):
    cutoff = int(time.time()) - RETENTION_DAYS * 86400
    conn.execute("DELETE FROM notes WHERE pinned = 0 AND created_at < ?", (cutoff,))


def error(message, status=400):
    return jsonify({"error": message}), status


def check_code(payload):
    """None when the family code is fine, else an error response. Throttles guessing."""
    if not FAMILY_CODE:
        return None
    ip = request.remote_addr
    now = time.time()
    count, since = _failures.get(ip, (0, now))
    if now - since > FAILURE_WINDOW:
        count, since = 0, now
    if count >= MAX_FAILURES:
        return error("Trop d'essais, réessaie dans quelques minutes", 429)
    if hmac.compare_digest(str((payload or {}).get("code", "")), FAMILY_CODE):
        _failures.pop(ip, None)
        return None
    _failures[ip] = (count + 1, since)
    return error("Code famille incorrect", 403)


def config():
    return {
        "members": MEMBERS,
        "colors": COLORS,
        "stickers": STICKERS,
        "maxChars": MAX_CHARS,
        "retentionDays": RETENTION_DAYS,
        "codeRequired": bool(FAMILY_CODE),
    }


@bp.route("/api/postits")
def list_notes():
    with db() as conn:
        purge_expired(conn)
        rows = conn.execute("SELECT * FROM notes ORDER BY pinned DESC, created_at DESC, id DESC").fetchall()
    return jsonify({"notes": [note_dict(r) for r in rows], "config": config()})


@bp.route("/api/postits/verify", methods=["POST"])
def verify_code():
    bad = check_code(request.get_json(silent=True))
    return bad or jsonify({"ok": True})


@bp.route("/api/postits", methods=["POST"])
def create_note():
    payload = request.get_json(silent=True) or {}
    bad = check_code(payload)
    if bad:
        return bad

    if not MEMBERS:
        return error("FAMILY_MEMBERS n'est pas configuré", 503)
    author = payload.get("author")
    if author not in MEMBERS:
        return error("Prénom inconnu")

    text = str(payload.get("text", "")).replace("\r", "").strip()
    if not text:
        return error("Le post-it est vide")
    if len(text) > MAX_CHARS:
        return error(f"{MAX_CHARS} caractères maximum")

    color = payload.get("color", COLORS[0])
    if color not in COLORS:
        return error("Couleur inconnue")
    sticker = payload.get("sticker") or None
    if sticker is not None and sticker not in STICKERS:
        return error("Sticker inconnu")

    ip = request.remote_addr
    now = time.time()
    if now - _last_post.get(ip, 0) < POST_COOLDOWN:
        return error("Doucement, un post-it à la fois", 429)
    _last_post[ip] = now

    with db() as conn:
        purge_expired(conn)
        cur = conn.execute(
            "INSERT INTO notes (author, text, color, sticker, created_at) VALUES (?, ?, ?, ?, ?)",
            (author, text, color, sticker, int(now)),
        )
        row = conn.execute("SELECT * FROM notes WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(note_dict(row)), 201


def _own_note(conn, note_id, payload):
    """(row, error response): only the author, with the family code, may change a note."""
    bad = check_code(payload)
    if bad:
        return None, bad
    row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    if row is None:
        return None, error("Post-it introuvable", 404)
    if row["author"] != (payload or {}).get("author"):
        return None, error("Ce post-it n'est pas le tien", 403)
    return row, None


@bp.route("/api/postits/<int:note_id>", methods=["DELETE"])
def delete_note(note_id):
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        row, bad = _own_note(conn, note_id, payload)
        if bad:
            return bad
        conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    return jsonify({"ok": True})


@bp.route("/api/postits/<int:note_id>/pin", methods=["POST"])
def pin_note(note_id):
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        row, bad = _own_note(conn, note_id, payload)
        if bad:
            return bad
        conn.execute("UPDATE notes SET pinned = ? WHERE id = ?", (1 if payload.get("pinned") else 0, note_id))
        row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    return jsonify(note_dict(row))
