"""Tests run on a throwaway data directory with a fake family, offline: every outside service is off
or replaced in the test itself. Run them with scripts/test.sh (in Docker, like the API)."""
import os
import sys
import tempfile

DATA_DIR = tempfile.mkdtemp(prefix="dashboard-tests-")
os.environ.update(
    DATA_DIR=DATA_DIR,
    FAMILY_MEMBERS="Alice,Bob",
    FAMILY_CODE="1234",
    PLEX_URL="http://plex.invalid:32400",
    PLEX_PUBLIC_URL="http://plex.example:32400",
    PLEX_TOKEN="test-token",
)
for name in ("COMFYUI_URL", "RECALBOX_HOST", "GEMINI_API_KEY", "CALENDAR_ID"):
    os.environ.pop(name, None)  # background workers and outside calls stay off

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402

import postits  # noqa: E402
import settings  # noqa: E402
from app import app as flask_app  # noqa: E402


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    return flask_app.test_client()


@pytest.fixture(autouse=True)
def clean_state():
    """Each test starts with no note, no setting, and no throttling memory."""
    postits._last_post.clear()
    postits._failures.clear()
    if postits._ready:
        with postits.db() as conn:
            conn.execute("DELETE FROM notes")
    try:
        os.remove(settings.SETTINGS_FILE)
    except OSError:
        pass
    yield
