"""Short "previously on" recaps for the screensaver's new episodes.

When a new episode of a started show hasn't been watched yet, the screensaver reminds where the story was
left: no API gives such a recap (Plex and TMDb only have each episode's teaser), so Gemini writes one from
Plex's own summaries of the last episodes watched, and nothing else. Like the trivia, the code then checks
it: every number and proper name must come from those summaries. Written once per episode, in the
background, kept in data/recaps.json; until then (or if it fails) the screensaver shows Plex's summary.
"""
import json
import os
import threading
import time

import trivia  # the Gemini call, the models and the code check are shared

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
STATE_FILE = os.path.join(DATA_DIR, "recaps.json")
MAX_CHARS = 200  # it must fit under the episode on the screensaver
RETRY_AFTER = 6 * 3600
MAX_ATTEMPTS = 3

_lock = threading.Lock()
_running = set()

PROMPT = """Tu écris le petit rappel « précédemment dans {show} » affiché sur l'écran de veille d'une famille qui va reprendre la série.

Voici les résumés officiels des derniers épisodes qu'elle a vus, dans l'ordre (le dernier compte le plus) :
{episodes}

Écris en français, au passé composé, en une ou deux phrases et {max_chars} caractères au maximum, où en était l'histoire à la fin du dernier épisode.
Règles :
- n'utilise que les informations de ces résumés : n'invente rien, ne parle d'aucun autre épisode, ne suppose rien sur la suite ;
- pas de titre, pas de guillemets, pas de « Dans l'épisode précédent » (c'est déjà affiché au-dessus).
Réponds uniquement par le rappel."""


def _load():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save(state):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = f"{STATE_FILE}.{os.getpid()}.tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, ensure_ascii=False, indent=1)
    os.replace(tmp, STATE_FILE)


def _clean(text):
    text = " ".join(text.split()).strip(" \"'«»“”")
    for prefix in ("Dans l'épisode précédent :", "Dans l'épisode précédent,", "Précédemment :", "Précédemment,"):
        if text.lower().startswith(prefix.lower()):
            text = text[len(prefix):].strip()
    return text[:1].upper() + text[1:]


def write_recap(show, episodes):
    """One recap from `episodes` ([{season, episode, title, summary}], oldest first). Raises ValueError when
    Gemini's answer is empty, too long, or names something the summaries don't."""
    lines = "\n".join(f"- S{e['season']}E{e['episode']} « {e.get('title') or ''} » : {e['summary']}" for e in episodes)
    text = _clean(trivia._gemini(PROMPT.format(show=show, episodes=lines, max_chars=MAX_CHARS), trivia.WRITE_MODEL))
    if not text:
        raise ValueError("empty answer")
    if len(text) > MAX_CHARS + 30:
        raise ValueError(f"too long ({len(text)} characters)")
    source = f"{show}\n{lines}"
    if not trivia.details_in_source(text, source):
        raise ValueError("a name or a number is not in the summaries")
    return text


def _generate(key, show, episodes):
    try:
        entry = {"text": write_recap(show, episodes), "at": int(time.time())}
    except Exception as e:  # Gemini down or slow, or an answer that failed the check: Plex's summary meanwhile
        entry = {"failedAt": int(time.time()), "error": str(e)[:200]}
    with _lock:
        state = _load()
        attempts = state.get(key, {}).get("attempts", 0) + (0 if "text" in entry else 1)
        state[key] = {**entry, "attempts": attempts}
        _save(state)
        _running.discard(key)


def recap_for(key, show, episodes):
    """The recap of the episode `key` (the last one watched) if it is ready, else None. When missing, it is
    written in the background, so the screensaver never waits for Gemini."""
    episodes = [e for e in episodes if e.get("summary")]
    if not episodes:
        return None
    with _lock:
        entry = _load().get(key, {})
        if entry.get("text"):
            return entry["text"]
        if not trivia.GEMINI_API_KEY or key in _running:
            return None
        if entry.get("attempts", 0) >= MAX_ATTEMPTS or time.time() - entry.get("failedAt", 0) < RETRY_AFTER:
            return None
        _running.add(key)
    threading.Thread(target=_generate, args=(key, show, episodes), daemon=True, name="recap").start()
    return None
