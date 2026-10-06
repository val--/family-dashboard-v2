import io
import json
import os
import shutil
import subprocess

import pytest
from PIL import Image

import postits

AUTH = {"author": "Alice", "code": "1234"}


def note(client, **fields):
    return client.post("/api/postits", json={**AUTH, "text": "Coucou", "color": "yellow", **fields})


def jpeg(width, height, orientation=None):
    buf = io.BytesIO()
    exif = Image.Exif()
    if orientation:
        exif[0x0112] = orientation
    exif[0x010F] = "PhoneMaker"  # any metadata: it must not survive
    Image.new("RGB", (width, height), (200, 80, 40)).save(buf, "JPEG", exif=exif)
    buf.seek(0)
    return buf


def upload(client, field, data, filename, **form):
    fields = {**AUTH, "text": "Avec un fichier", "color": "blue", **form, field: (data, filename)}
    return client.post("/api/postits", data=fields, content_type="multipart/form-data")


def stored(name):
    return os.path.join(postits.PHOTO_DIR, name)


# ---- Text notes, family code, throttling


def test_a_text_note_is_created_and_listed(client):
    res = note(client, text="  Bonne journée !  ", sticker="heart")
    assert res.status_code == 201
    created = res.get_json()
    assert created["text"] == "Bonne journée !" and created["author"] == "Alice" and created["sticker"] == "heart"
    assert created["photo"] is None and created["video"] is False
    listed = client.get("/api/postits").get_json()
    assert [n["id"] for n in listed["notes"]] == [created["id"]]
    assert listed["config"]["members"] == ["Alice", "Bob"] and listed["config"]["codeRequired"] is True


@pytest.mark.parametrize("fields, message", [
    ({"text": "   "}, "vide"),
    ({"text": "x" * 201}, "200 caractères"),
    ({"author": "Mallory"}, "Prénom inconnu"),
    ({"color": "black"}, "Couleur inconnue"),
    ({"sticker": "skull"}, "Sticker inconnu"),
])
def test_invalid_notes_are_refused(client, fields, message):
    res = note(client, **fields)
    assert res.status_code == 400
    assert message in res.get_json()["error"]


def test_a_wrong_family_code_is_refused_then_throttled(client):
    for _ in range(postits.MAX_FAILURES):
        assert note(client, code="0000").status_code == 403
    # too many tries: even the right code waits now
    assert note(client).status_code == 429


def test_two_notes_in_a_row_from_the_same_device_are_slowed_down(client):
    assert note(client).status_code == 201
    assert note(client).status_code == 429


def test_only_the_author_can_delete_a_note(client):
    created = note(client).get_json()
    assert client.delete(f"/api/postits/{created['id']}", json={"author": "Bob", "code": "1234"}).status_code == 403
    assert client.delete(f"/api/postits/{created['id']}", json=AUTH).status_code == 200
    assert client.get("/api/postits").get_json()["notes"] == []


# ---- Photos


def test_a_photo_is_stored_in_two_sizes_without_its_metadata(client):
    res = upload(client, "photo", jpeg(2400, 1800), "photo.jpg")
    assert res.status_code == 201
    name = res.get_json()["photo"]
    assert res.get_json()["photoRatio"] == pytest.approx(4 / 3, abs=0.001)
    with Image.open(stored(f"{name}.jpg")) as full, Image.open(stored(f"{name}_thumb.jpg")) as thumb:
        assert max(full.size) == 1200 and max(thumb.size) == 400
        assert not full.getexif()


def test_a_photo_taken_sideways_is_turned_upright(client):
    # stored 200 x 100 with "rotate 90°" in its EXIF: it is really a portrait
    res = upload(client, "photo", jpeg(200, 100, orientation=6), "photo.jpg")
    assert res.get_json()["photoRatio"] == pytest.approx(0.5)


def test_a_file_that_is_not_an_image_is_refused(client):
    res = upload(client, "photo", io.BytesIO(b"definitely not a picture"), "photo.jpg")
    assert res.status_code == 400 and "illisible" in res.get_json()["error"]


def test_a_photo_above_12_mb_is_refused(client):
    res = upload(client, "photo", io.BytesIO(os.urandom(postits.MAX_PHOTO_BYTES + 1)), "photo.jpg")
    assert res.status_code == 413


def test_deleting_a_note_removes_its_files(client):
    created = upload(client, "photo", jpeg(800, 600), "photo.jpg").get_json()
    assert os.path.exists(stored(f"{created['photo']}.jpg"))
    client.delete(f"/api/postits/{created['id']}", json=AUTH)
    assert not os.path.exists(stored(f"{created['photo']}.jpg"))
    assert not os.path.exists(stored(f"{created['photo']}_thumb.jpg"))


def test_photo_names_are_checked_before_touching_the_disk(client):
    assert client.get("/api/postits/photos/..%2Fpostits.db").status_code == 404
    assert client.get("/api/postits/photos/settings.json").status_code == 404


def test_a_scanned_download_is_named_after_its_author(client):
    name = upload(client, "photo", jpeg(800, 600), "photo.jpg").get_json()["photo"]
    res = client.get(f"/api/postits/photos/{name}.jpg?download=1")
    assert res.status_code == 200
    assert "attachment" in res.headers["Content-Disposition"] and "post-it-Alice-" in res.headers["Content-Disposition"]


# ---- Videos (need ffmpeg, which the API image has)

ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")


def make_video(tmp_path, seconds, size="640x360", rotation=None):
    path = tmp_path / "source.mp4"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"testsrc2=size={size}:rate=30:duration={seconds}",
         "-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}", "-c:v", "libx264", "-preset", "ultrafast",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-metadata", "location=+47.2-001.5/", str(path)],
        check=True,
    )
    if rotation:
        rotated = tmp_path / "rotated.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-display_rotation:v", str(rotation), "-i", str(path), "-c", "copy",
                        str(rotated)], check=True)
        path = rotated
    return path


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:format_tags:stream=codec_type,width,height",
                          "-of", "json", path], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


@ffmpeg
def test_a_long_video_is_cut_to_10_light_seconds_with_its_sound(client, tmp_path):
    source = make_video(tmp_path, 15, size="1920x1080")
    with open(source, "rb") as f:
        res = upload(client, "video", f, "clip.mp4", start="3")
    assert res.status_code == 201, res.get_json()
    created = res.get_json()
    assert created["video"] is True and created["stickerStatus"] is None  # no die-cut sticker for videos
    info = probe(stored(f"{created['photo']}.mp4"))
    assert float(info["format"]["duration"]) == pytest.approx(10, abs=0.2)
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    assert (video["width"], video["height"]) == (854, 480)
    assert any(s["codec_type"] == "audio" for s in info["streams"])
    assert "location" not in info["format"].get("tags", {})  # GPS dropped
    assert os.path.exists(stored(f"{created['photo']}_thumb.jpg"))  # the poster, stored like a photo


@ffmpeg
def test_a_start_too_close_to_the_end_still_gives_10_seconds(client, tmp_path):
    source = make_video(tmp_path, 12)
    with open(source, "rb") as f:
        created = upload(client, "video", f, "clip.mp4", start="11").get_json()
    assert float(probe(stored(f"{created['photo']}.mp4"))["format"]["duration"]) == pytest.approx(10, abs=0.2)


@ffmpeg
def test_a_phone_video_filmed_upright_stays_upright(client, tmp_path):
    source = make_video(tmp_path, 4, size="1280x720", rotation=90)
    with open(source, "rb") as f:
        created = upload(client, "video", f, "clip.mp4").get_json()
    assert created["photoRatio"] < 1


@ffmpeg
def test_a_video_is_served_in_pieces_for_the_player(client, tmp_path):
    with open(make_video(tmp_path, 3), "rb") as f:
        name = upload(client, "video", f, "clip.mp4").get_json()["photo"]
    res = client.get(f"/api/postits/photos/{name}.mp4", headers={"Range": "bytes=0-99"})
    assert res.status_code == 206 and len(res.data) == 100 and res.mimetype == "video/mp4"


def test_a_file_that_is_not_a_video_is_refused(client):
    res = upload(client, "video", io.BytesIO(os.urandom(50_000)), "clip.mp4")
    assert res.status_code == 400 and "illisible" in res.get_json()["error"].lower()
    assert not [f for f in os.listdir(postits.PHOTO_DIR) if f.endswith(".mp4") and os.path.getsize(os.path.join(postits.PHOTO_DIR, f)) == 0]


def test_a_video_above_the_limit_is_refused(client, monkeypatch):
    monkeypatch.setattr(postits, "MAX_VIDEO_BYTES", 10_000)
    res = upload(client, "video", io.BytesIO(os.urandom(2 * 1024 * 1024)), "clip.mp4")
    assert res.status_code == 413


# ---- Orphan files


def put_file(name, age_seconds):
    os.makedirs(postits.PHOTO_DIR, exist_ok=True)
    path = stored(name)
    with open(path, "wb") as f:
        f.write(b"x")
    old = os.path.getmtime(path) - age_seconds
    os.utime(path, (old, old))
    return path


def test_orphan_files_are_removed_but_never_a_note_s_or_a_recent_one(client):
    kept = upload(client, "photo", jpeg(800, 600), "photo.jpg").get_json()["photo"]
    for suffix in (".jpg", "_thumb.jpg"):  # the note's own files, made old: still kept
        os.utime(stored(f"{kept}{suffix}"), (1, 1))
    orphan = "a" * 32
    put_file(f"{orphan}.jpg", 2 * 3600)
    put_file(f"{orphan}_sticker_thumb.png", 2 * 3600)
    put_file(f"{'b' * 32}.mp4", 60)  # an upload in progress
    put_file("notes.txt", 2 * 3600)  # not one of ours: left alone

    assert sorted(postits.remove_orphan_files()) == [f"{orphan}.jpg", f"{orphan}_sticker_thumb.png"]
    assert os.path.exists(stored(f"{kept}.jpg")) and os.path.exists(stored(f"{kept}_thumb.jpg"))
    assert os.path.exists(stored(f"{'b' * 32}.mp4")) and os.path.exists(stored("notes.txt"))
    for name in (f"{'b' * 32}.mp4", "notes.txt"):
        os.remove(stored(name))


def test_cleanup_never_wipes_the_photos_when_no_note_refers_to_any(client):
    path = put_file(f"{'c' * 32}.jpg", 2 * 3600)
    with postits.db() as conn:
        conn.execute("DELETE FROM notes")
    assert postits.remove_orphan_files() == []
    assert os.path.exists(path)
    os.remove(path)
