"""Die-cut sticker version of every post-it photo, made by ComfyUI (see ~/ai/comfyui, node 'postit-sticker').

Each photo note gets sticker_status = 'pending' at upload. A background thread (one per gunicorn worker) claims
pending notes one at a time, sends the photo to ComfyUI, and stores the result next to the photo as
<name>_sticker.png. If ComfyUI is down it simply retries later; after MAX_ATTEMPTS real failures the note is
marked 'failed'. Nothing here blocks a request.
"""
import json
import os
import threading
import time
import urllib.parse
import urllib.request
import uuid

COMFYUI_URL = os.environ.get("COMFYUI_URL", "").strip().rstrip("/")  # empty = feature off
POLL_SECONDS = 20
JOB_TIMEOUT = 180
MAX_ATTEMPTS = 3
STALE_CLAIM = 15 * 60  # a claim older than this was lost (restart...): make it pending again

# The workflow tested in ComfyUI (~/ai/comfyui/workflows/postit_sticker_api.json), with a PreviewImage
# output so ComfyUI keeps nothing (its temp folder is wiped on restart).
WORKFLOW = {
    "1": {"class_type": "LoadImage", "inputs": {"image": ""}},
    "2": {"class_type": "PostitBiRefNet", "inputs": {"image": ["1", 0], "model": "BiRefNet", "resolution": 1024}},
    "3": {
        "class_type": "PostitStickerOutline",
        "inputs": {"image": ["2", 0], "mask": ["2", 1], "border": 22, "shadow": 0.35, "threshold": 0.5, "keep_largest": True, "smooth": 8},
    },
    "4": {"class_type": "PreviewImage", "inputs": {"images": ["3", 0]}},
}

_thread = None
_lock = threading.Lock()


STICKER_SIDE = 1200  # full size (the node crops tight, so it is usually smaller already)
THUMB_SIDE = 400  # what the wall and the screensaver load


def sticker_path(photo_dir, name, thumb=False):
    return os.path.join(photo_dir, f"{name}_sticker{'_thumb' if thumb else ''}.png")


def _save_versions(png_bytes, photo_dir, name):
    import io

    from PIL import Image

    image = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    for thumb, side in ((False, STICKER_SIDE), (True, THUMB_SIDE)):
        version = image.copy()
        version.thumbnail((side, side), Image.LANCZOS)
        out = sticker_path(photo_dir, name, thumb)
        version.save(f"{out}.part", "PNG", optimize=True)
        os.replace(f"{out}.part", out)


def _request(path, data=None, headers=None, timeout=30):
    req = urllib.request.Request(f"{COMFYUI_URL}{path}", data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _upload(image_path, upload_name):
    boundary = uuid.uuid4().hex
    with open(image_path, "rb") as f:
        content = f.read()
    body = b"".join([
        f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{upload_name}"\r\nContent-Type: image/jpeg\r\n\r\n'.encode(),
        content,
        f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="subfolder"\r\n\r\npostit\r\n'.encode(),
        f'--{boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{boundary}--\r\n'.encode(),
    ])
    reply = json.loads(_request("/upload/image", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}))
    return f"{reply['subfolder']}/{reply['name']}" if reply.get("subfolder") else reply["name"]


def make_sticker(photo_path, photo_dir, name):
    """Run the workflow on one photo. Raises ConnectionError when ComfyUI can't be reached (retry later)."""
    try:
        # one input file per API worker process, overwritten each time: ComfyUI's input folder doesn't grow
        image = _upload(photo_path, f"job_{os.getpid()}.jpg")
    except OSError as e:
        raise ConnectionError(str(e)) from e
    workflow = json.loads(json.dumps(WORKFLOW))
    workflow["1"]["inputs"]["image"] = image
    prompt_id = json.loads(_request("/prompt", json.dumps({"prompt": workflow}).encode(), {"Content-Type": "application/json"}))["prompt_id"]

    deadline = time.time() + JOB_TIMEOUT
    while time.time() < deadline:
        history = json.loads(_request(f"/history/{prompt_id}"))
        if prompt_id in history:
            entry = history[prompt_id]
            if entry["status"].get("status_str") != "success":
                raise RuntimeError(f"ComfyUI: {entry['status'].get('status_str')}")
            images = [im for out in entry["outputs"].values() for im in out.get("images", [])]
            if not images:
                raise RuntimeError("ComfyUI: no image produced")
            im = images[0]
            query = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im.get("subfolder", ""), "type": im.get("type", "temp")})
            _save_versions(_request(f"/view?{query}", timeout=60), photo_dir, name)
            return
        time.sleep(1)
    raise RuntimeError("ComfyUI: timed out")


def _claim(db):
    """Atomically take one pending note (both gunicorn workers poll the same database)."""
    now = time.time()
    with db() as conn:
        conn.execute(
            "UPDATE notes SET sticker_status = 'pending' WHERE sticker_status = 'working' AND sticker_claimed < ?",
            (now - STALE_CLAIM,),
        )
        row = conn.execute(
            "SELECT id, photo, sticker_attempts FROM notes WHERE sticker_status = 'pending' AND photo IS NOT NULL ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        if row is None:
            return None
        taken = conn.execute(
            "UPDATE notes SET sticker_status = 'working', sticker_claimed = ? WHERE id = ? AND sticker_status = 'pending'",
            (now, row["id"]),
        ).rowcount
    return row if taken else None


def _loop(db, photo_dir):
    while True:
        try:
            row = _claim(db)
            if row is None:
                time.sleep(POLL_SECONDS)
                continue
            unreachable = False
            try:
                make_sticker(os.path.join(photo_dir, f"{row['photo']}.jpg"), photo_dir, row["photo"])
                status, attempts = "done", row["sticker_attempts"]
            except ConnectionError:
                status, attempts, unreachable = "pending", row["sticker_attempts"], True  # ComfyUI down: not the photo's fault
            except Exception:
                attempts = row["sticker_attempts"] + 1
                status = "failed" if attempts >= MAX_ATTEMPTS else "pending"
            with db() as conn:
                updated = conn.execute(
                    "UPDATE notes SET sticker_status = ?, sticker_attempts = ? WHERE id = ?", (status, attempts, row["id"])
                ).rowcount
            if updated == 0 and status == "done":  # the note was deleted meanwhile: drop the orphan files
                for thumb in (False, True):
                    try:
                        os.remove(sticker_path(photo_dir, row["photo"], thumb))
                    except OSError:
                        pass
            if unreachable:
                time.sleep(POLL_SECONDS * 3)
        except Exception:
            time.sleep(POLL_SECONDS)


def start_worker(db, photo_dir):
    global _thread
    if not COMFYUI_URL:
        return
    with _lock:
        if _thread is None:
            _thread = threading.Thread(target=_loop, args=(db, photo_dir), daemon=True, name="postit-stickers")
            _thread.start()
