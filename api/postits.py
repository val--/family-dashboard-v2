"""Family post-it board: notes written from phones on the LAN, shown on the kiosk."""
import hmac
import os
import re
import sqlite3
import time
import uuid

from flask import Blueprint, jsonify, request, send_from_directory
from PIL import Image, ImageOps

import postit_stickers

bp = Blueprint("postits", __name__)

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "postits.db")
PHOTO_DIR = os.path.join(DATA_DIR, "photos")

FAMILY_CODE = os.environ.get("FAMILY_CODE", "").strip()  # empty = no code required
MEMBERS = [m.strip() for m in os.environ.get("FAMILY_MEMBERS", "").split(",") if m.strip()]


def _int_env(name, default):
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


MAX_CHARS = 200
COLORS = ["yellow", "pink", "blue", "green", "orange", "purple"]
STICKERS = ["heart", "star", "smile", "sun", "music", "coffee", "pizza", "cat", "gift", "party", "book", "ball"]

POST_COOLDOWN = 5  # seconds between two notes from the same device

# Phone photos are huge (4000x3000): keep a 1200 px version for full screen and a 400 px one for the
# wall, so the kiosk never has to decode more than it shows.
PHOTO_SIZES = (("", 1200, 82), ("_thumb", 400, 78))  # (file suffix, longest side, JPEG quality)
PHOTO_FORMATS = {"JPEG", "PNG", "WEBP"}
PHOTO_NAME = re.compile(r"^[0-9a-f]{32}((_thumb)?\.jpg|_sticker(_thumb)?\.png)$")
Image.MAX_IMAGE_PIXELS = 50_000_000  # refuse decompression bombs (error above twice this)
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
                   pinned INTEGER NOT NULL DEFAULT 0  -- unused since pinning was removed, kept for old databases
               )"""
        )
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(notes)")}
        for name, kind in (("photo", "TEXT"), ("photo_ratio", "REAL"), ("sticker_status", "TEXT"),
                           ("sticker_attempts", "INTEGER NOT NULL DEFAULT 0"), ("sticker_claimed", "REAL")):
            if name not in columns:
                try:
                    conn.execute(f"ALTER TABLE notes ADD COLUMN {name} {kind}")
                except sqlite3.OperationalError:
                    pass  # the other gunicorn worker added it first
        # Photos stored before the ratio was recorded: read it from the file header (cheap, done once)
        for row in conn.execute("SELECT id, photo FROM notes WHERE photo IS NOT NULL AND photo_ratio IS NULL").fetchall():
            try:
                with Image.open(os.path.join(PHOTO_DIR, f"{row['photo']}.jpg")) as im:
                    conn.execute("UPDATE notes SET photo_ratio = ? WHERE id = ?", (round(im.width / im.height, 4), row["id"]))
            except OSError:
                pass
    _ready = True
    postit_stickers.start_worker(db, PHOTO_DIR)


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
        "photo": row["photo"],
        "photoRatio": row["photo_ratio"],  # width / height: below 1 = portrait (e.g. 0.56 for 9:16)
        # die-cut sticker made by ComfyUI after the upload: None (no photo / feature off), pending, done, failed
        "stickerStatus": row["sticker_status"],
    }


class PhotoError(ValueError):
    pass


def save_photo(file_storage):
    """Validate an uploaded image and re-encode it: fixed formats, rotated upright, no metadata (GPS...),
    two sizes. Returns the base name of the files."""
    try:
        image = Image.open(file_storage.stream)
        if image.format not in PHOTO_FORMATS:
            raise PhotoError("Format non pris en charge (JPEG, PNG ou WebP)")
        image.load()  # decodes everything: catches truncated or corrupted files
    except PhotoError:
        raise
    except (OSError, ValueError, Image.DecompressionBombError):
        raise PhotoError("Photo illisible (JPEG, PNG ou WebP)") from None

    image = ImageOps.exif_transpose(image)
    if image.mode in ("RGBA", "LA") or "transparency" in image.info:
        flat = Image.new("RGB", image.size, (255, 255, 255))
        flat.paste(image.convert("RGBA"), mask=image.convert("RGBA").split()[3])
        image = flat
    image = image.convert("RGB")

    os.makedirs(PHOTO_DIR, exist_ok=True)
    ratio = round(image.width / image.height, 4)
    name = uuid.uuid4().hex
    for suffix, side, quality in PHOTO_SIZES:
        version = image.copy()
        version.thumbnail((side, side), Image.LANCZOS)
        version.save(os.path.join(PHOTO_DIR, f"{name}{suffix}.jpg"), "JPEG", quality=quality, optimize=True, progressive=True)
    return name, ratio


def remove_photos(names):
    for name in names:
        for suffix, _, _ in PHOTO_SIZES:
            try:
                os.remove(os.path.join(PHOTO_DIR, f"{name}{suffix}.jpg"))
            except OSError:
                pass
        for thumb in (False, True):
            try:
                os.remove(postit_stickers.sticker_path(PHOTO_DIR, name, thumb))
            except OSError:
                pass


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
        "codeRequired": bool(FAMILY_CODE),
    }


@bp.route("/api/postits")
def list_notes():
    # Notes are kept until their author deletes them: there is no expiry
    with db() as conn:
        rows = conn.execute("SELECT * FROM notes ORDER BY created_at DESC, id DESC").fetchall()
    return jsonify({"notes": [note_dict(r) for r in rows], "config": config()})


@bp.route("/api/postits/verify", methods=["POST"])
def verify_code():
    bad = check_code(request.get_json(silent=True))
    return bad or jsonify({"ok": True})


@bp.route("/api/postits", methods=["POST"])
def create_note():
    # JSON for a text-only note, multipart/form-data when a photo comes along
    if request.is_json:
        payload, upload = request.get_json(silent=True) or {}, None
    else:
        payload, upload = request.form.to_dict(), request.files.get("photo")
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

    photo, ratio = None, None
    if upload and upload.filename:
        try:
            photo, ratio = save_photo(upload)
        except PhotoError as e:
            return error(str(e))

    try:
        with db() as conn:
            cur = conn.execute(
                "INSERT INTO notes (author, text, color, sticker, created_at, photo, photo_ratio, sticker_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (author, text, color, sticker, int(now), photo, ratio, "pending" if photo and postit_stickers.COMFYUI_URL else None),
            )
            row = conn.execute("SELECT * FROM notes WHERE id = ?", (cur.lastrowid,)).fetchone()
    except Exception:
        remove_photos([photo] if photo else [])  # don't leave orphans behind
        raise
    return jsonify(note_dict(row)), 201


@bp.route("/api/postits/photos/<path:filename>")
def get_photo(filename):
    if not PHOTO_NAME.match(filename):
        return error("Photo introuvable", 404)
    if request.args.get("download"):
        # Scanned from the kiosk's QR code: the phone saves it as a file instead of just showing it
        name = "post-it"
        with db() as conn:
            row = conn.execute("SELECT author, created_at FROM notes WHERE photo = ?", (filename.split("_")[0][:32],)).fetchone()
        if row:
            day = time.strftime("%Y-%m-%d", time.localtime(row["created_at"]))
            name = f"post-it-{row['author']}-{day}"
        png = filename.endswith(".png")
        return send_from_directory(PHOTO_DIR, filename, mimetype="image/png" if png else "image/jpeg", as_attachment=True,
                                   download_name=f"{name}{'-sticker.png' if png else '.jpg'}")
    response = send_from_directory(PHOTO_DIR, filename, mimetype="image/png" if filename.endswith(".png") else "image/jpeg")
    response.headers["Cache-Control"] = "public, max-age=604800, immutable"  # a file never changes
    return response


@bp.app_errorhandler(413)
def too_large(_):
    return error("Fichier trop volumineux (12 Mo maximum)", 413)


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
    if row["photo"]:
        remove_photos([row["photo"]])
    return jsonify({"ok": True})
