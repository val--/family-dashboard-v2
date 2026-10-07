"""Plex: latest movies (with cast and backdrop), latest shows, on deck, and the last watched movie's trivia."""
import os
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from flask import Blueprint, jsonify

import recaps
import trivia

bp = Blueprint("plex", __name__)

# -- Plex config --
PLEX_URL = os.environ.get("PLEX_URL", "http://localhost:32400")
PLEX_PUBLIC_URL = os.environ.get("PLEX_PUBLIC_URL", PLEX_URL)
PLEX_TOKEN = os.environ.get("PLEX_TOKEN", "")

# -- Gemini config --
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

def plex_thumb_url(thumb, width=400, height=600, blur=0):
    """Resized poster URL through Plex's transcoder (originals are ~2000x3000), blurred by Plex if asked."""
    if not thumb:
        return None
    src = urllib.parse.quote(thumb, safe="")
    return (
        f"{PLEX_PUBLIC_URL}/photo/:/transcode?width={width}&height={height}"
        f"&minSize=1&upscale=0&url={src}{f'&blur={blur}' if blur else ''}&X-Plex-Token={PLEX_TOKEN}"
    )


def parse_plex_episode(item):
    """Extract episode info from a Plex XML element."""
    thumb = item.get("grandparentThumb") or item.get("thumb")
    return {
        "show": item.get("grandparentTitle"),
        "season": int(item.get("parentIndex", 0)),
        "episode": int(item.get("index", 0)),
        "title": item.get("title"),
        "addedAt": item.get("addedAt"),
        "lastViewedAt": item.get("lastViewedAt"),
        "thumb": plex_thumb_url(thumb),
        "watched": int(item.get("viewCount", 0)) > 0,
        "year": item.get("year"),
        "summary": item.get("summary"),
        "rating": item.get("audienceRating") or item.get("rating"),
        "contentRating": item.get("contentRating"),
        "genres": [g.get("tag") for g in item.findall("Genre")][:4],
    }


def parse_plex_movie(item):
    """Extract movie info from a Plex XML element."""
    thumb = item.get("thumb")
    duration_ms = item.get("duration")
    duration_min = round(int(duration_ms) / 60000) if duration_ms else None

    genres = [g.get("tag") for g in item.findall("Genre")]
    directors = [d.get("tag") for d in item.findall("Director")]
    roles = [r.get("tag") for r in item.findall("Role")]

    return {
        "key": item.get("ratingKey"),
        "title": item.get("title"),
        "year": item.get("year"),
        "summary": item.get("summary"),
        "rating": item.get("audienceRating"),
        "contentRating": item.get("contentRating"),
        "duration": duration_min,
        "genres": genres[:4],
        "directors": directors[:2],
        "actors": roles[:5],
        "addedAt": item.get("addedAt"),
        "lastViewedAt": item.get("lastViewedAt"),
        "thumb": plex_thumb_url(thumb),
        # backdrop for the screensaver: small and softly blurred by Plex (no costly CSS filter on the Pi)
        "art": plex_thumb_url(item.get("art"), 640, 360, blur=8),
        "watched": int(item.get("viewCount", 0)) > 0,
    }


CAST_FOR_LATEST = 8  # the screensaver shows the latest movies with their cast (its MAX_MOVIES)
CAST_SIZE = 4
_cast_cache = {}  # ratingKey -> cast; a movie's cast doesn't change


def plex_movie_cast(key):
    """Main actors with their photo (resized by Plex), from the movie's full metadata: the library
    listing only has their names. None when Plex can't answer (tried again next time)."""
    if key in _cast_cache:
        return _cast_cache[key]

    try:
        url = f"{PLEX_URL}/library/metadata/{key}?X-Plex-Token={PLEX_TOKEN}"
        with urllib.request.urlopen(url, timeout=5) as resp:
            video = ET.parse(resp).getroot().find("Video")
    except Exception:
        return None
    if video is None:
        return None
    cast = [
        {"name": role.get("tag"), "role": role.get("role"), "thumb": plex_thumb_url(role.get("thumb"), 96, 96)}
        for role in video.findall("Role")[:CAST_SIZE]
    ]
    _cast_cache[key] = cast
    return cast


@bp.route("/api/plex/recent")
def plex_recent():
    if not PLEX_TOKEN:
        return jsonify({"error": "PLEX_TOKEN not configured"}), 500

    try:
        section_key = find_plex_section("movie")
        if not section_key:
            return jsonify({"movies": []})

        url = f"{PLEX_URL}/library/sections/{section_key}/recentlyAdded?X-Plex-Token={PLEX_TOKEN}&X-Plex-Container-Size=50"
        req = urllib.request.Request(url, headers={"Accept": "application/xml"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            tree = ET.parse(resp)

        movies = []
        for item in tree.getroot():
            if item.get("type") != "movie":
                continue
            movie = parse_plex_movie(item)
            if len(movies) < CAST_FOR_LATEST and movie["key"]:
                movie["cast"] = plex_movie_cast(movie["key"])
            movies.append(movie)
            if len(movies) >= 20:
                break

        return jsonify({"movies": movies})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


SECTION_CACHE_SECONDS = 3600  # libraries are almost never added or removed
_section_cache = {}  # type -> (time, key); found keys only


def find_plex_section(section_type):
    """The Plex library section key for a given type (e.g. 'show', 'movie'). Remembered for an hour:
    every movie/show/trivia call used to fetch the list of libraries again first."""
    cached = _section_cache.get(section_type)
    if cached and time.time() - cached[0] < SECTION_CACHE_SECONDS:
        return cached[1]
    url = f"{PLEX_URL}/library/sections?X-Plex-Token={PLEX_TOKEN}"
    req = urllib.request.Request(url, headers={"Accept": "application/xml"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        tree = ET.parse(resp)
    for directory in tree.getroot():
        if directory.get("type") == section_type:
            _section_cache[section_type] = (time.time(), directory.get("key"))
            return directory.get("key")
    return None


@bp.route("/api/plex/ondeck")
def plex_ondeck():
    if not PLEX_TOKEN:
        return jsonify({"error": "PLEX_TOKEN not configured"}), 500

    try:
        url = f"{PLEX_URL}/library/onDeck?X-Plex-Token={PLEX_TOKEN}"
        req = urllib.request.Request(url, headers={"Accept": "application/xml"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            tree = ET.parse(resp)

        shows = []
        season_cache = {}

        for item in tree.getroot():
            if item.get("type") != "episode":
                continue

            thumb = item.get("grandparentThumb") or item.get("thumb")
            parent_key = item.get("parentRatingKey")
            season_num = int(item.get("parentIndex", 0))

            # Get season leaf counts (cached)
            watched = 0
            total = None
            if parent_key:
                if parent_key not in season_cache:
                    try:
                        s_url = f"{PLEX_URL}/library/metadata/{parent_key}?X-Plex-Token={PLEX_TOKEN}"
                        s_req = urllib.request.Request(s_url, headers={"Accept": "application/xml"})
                        with urllib.request.urlopen(s_req, timeout=5) as s_resp:
                            s_tree = ET.parse(s_resp)
                        s_el = s_tree.getroot().find(".//Directory")
                        if s_el is None:
                            s_el = s_tree.getroot()
                        season_cache[parent_key] = {
                            "leafCount": int(s_el.get("leafCount", 0)),
                            "viewedLeafCount": int(s_el.get("viewedLeafCount", 0)),
                        }
                    except Exception:
                        season_cache[parent_key] = {}

                meta = season_cache[parent_key]
                watched = meta.get("viewedLeafCount", 0)
                total = meta.get("leafCount") or None

            shows.append({
                "show": item.get("grandparentTitle"),
                "season": season_num,
                "watched": watched,
                "total": total,
                "thumb": plex_thumb_url(thumb),
                "nextEpisode": item.get("title"),
                "nextIndex": int(item.get("index", 0)),
            })

        return jsonify({"shows": shows})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


EPISODE_WINDOW_DAYS = 14  # the longest screensaver setting: it filters further by itself
SHOW_CACHE_SECONDS = 10 * 60  # a show's watched count changes as the family watches it
_show_cache = {}  # show ratingKey -> (time, Directory element)


def _plex_xml(path):
    """A Plex XML answer's root element (path with its query, without the token)."""
    sep = "&" if "?" in path else "?"
    req = urllib.request.Request(f"{PLEX_URL}{path}{sep}X-Plex-Token={PLEX_TOKEN}", headers={"Accept": "application/xml"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return ET.parse(resp).getroot()


def plex_show(key):
    """A show's own metadata (how many episodes were watched, its summary), kept 10 minutes."""
    cached = _show_cache.get(key)
    if cached and time.time() - cached[0] < SHOW_CACHE_SECONDS:
        return cached[1]
    show = _plex_xml(f"/library/metadata/{key}").find("Directory")
    if show is not None:
        _show_cache[key] = (time.time(), show)
    return show


_episodes_cache = {}  # show ratingKey -> (time, its episodes in story order)


def plex_show_episodes(key):
    """Every episode of a show, in story order (season, then number), kept 10 minutes."""
    cached = _episodes_cache.get(key)
    if cached and time.time() - cached[0] < SHOW_CACHE_SECONDS:
        return cached[1]
    episodes = sorted(_plex_xml(f"/library/metadata/{key}/allLeaves"),
                      key=lambda e: (int(e.get("parentIndex") or 0), int(e.get("index") or 0)))
    _episodes_cache[key] = (time.time(), episodes)
    return episodes


def _episode_info(e):
    return {"season": int(e.get("parentIndex") or 0), "episode": int(e.get("index") or 0),
            "title": e.get("title"), "summary": e.get("summary")}


def previously(show_key, show_title, new_key):
    """Where the family left the show before the new episode `new_key`: the last episode watched before it,
    how many episodes back it is (1 = just before), its Plex summary and the short recap (None until
    Gemini wrote it). None when nothing was watched before it."""
    episodes = plex_show_episodes(show_key)
    position = next((i for i, e in enumerate(episodes) if e.get("ratingKey") == new_key), None)
    if position is None:
        return None
    watched = [i for i in range(position) if int(episodes[i].get("viewCount") or 0) > 0]
    if not watched:
        return None
    last = episodes[watched[-1]]
    context = [_episode_info(episodes[i]) for i in watched[-3:]]  # the recap's material: the last 3 watched
    return {
        **_episode_info(last),
        "distance": position - watched[-1],
        "recap": recaps.recap_for(last.get("ratingKey"), show_title, context),
    }


@bp.route("/api/plex/new-episodes")
def plex_new_episodes():
    """The latest episode added per show in the last two weeks, for the shows the family has started
    (at least one episode watched). No spoiler: an episode's own summary only comes when it was watched,
    and the picture is the show's poster, never a still of the episode. Otherwise `previously` reminds
    where the story was left (the last episode watched before it, see previously())."""
    if not PLEX_TOKEN:
        return jsonify({"error": "PLEX_TOKEN not configured"}), 500
    try:
        section_key = find_plex_section("show")
        if not section_key:
            return jsonify({"episodes": []})
        since = time.time() - EPISODE_WINDOW_DAYS * 86400
        by_show = {}
        for item in _plex_xml(f"/library/sections/{section_key}/recentlyAdded?X-Plex-Container-Size=100"):
            if item.get("type") != "episode" or int(item.get("addedAt") or 0) < since:
                continue
            by_show.setdefault(item.get("grandparentRatingKey"), []).append(item)

        episodes = []
        for show_key, items in by_show.items():
            show = plex_show(show_key)
            if show is None or int(show.get("viewedLeafCount") or 0) == 0:
                continue  # not started: nobody is waiting for it
            items.sort(key=lambda e: int(e.get("addedAt") or 0), reverse=True)
            latest = items[0]
            watched = int(latest.get("viewCount") or 0) > 0
            episodes.append({
                "key": latest.get("ratingKey"),
                "show": latest.get("grandparentTitle"),
                "season": int(latest.get("parentIndex") or 0),
                "episode": int(latest.get("index") or 0),
                "title": latest.get("title"),
                "addedAt": int(latest.get("addedAt") or 0),
                "watched": watched,
                "summary": latest.get("summary") if watched else None,
                "showSummary": show.get("summary"),
                "thumb": plex_thumb_url(latest.get("grandparentThumb")),
                "art": plex_thumb_url(latest.get("grandparentArt"), 640, 360, blur=8),
                "addedTimes": [int(e.get("addedAt") or 0) for e in items],  # every new episode of the show
                "previously": None if watched else previously(show_key, latest.get("grandparentTitle"), latest.get("ratingKey")),
            })
        episodes.sort(key=lambda e: e["addedAt"], reverse=True)
        return jsonify({"episodes": episodes})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/plex/shows")
def plex_shows():
    if not PLEX_TOKEN:
        return jsonify({"error": "PLEX_TOKEN not configured"}), 500

    try:
        section_key = find_plex_section("show")
        if not section_key:
            return jsonify({"shows": []})

        url = f"{PLEX_URL}/library/sections/{section_key}/recentlyAdded?X-Plex-Token={PLEX_TOKEN}&X-Plex-Container-Size=50"
        req = urllib.request.Request(url, headers={"Accept": "application/xml"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            tree = ET.parse(resp)

        # Group episodes by show, keep the most recent episode per show
        shows = {}
        for item in tree.getroot():
            if item.get("type") != "episode":
                continue
            ep = parse_plex_episode(item)
            show_name = ep["show"]
            if show_name not in shows:
                shows[show_name] = ep
                shows[show_name]["episodes"] = 1
            else:
                shows[show_name]["episodes"] += 1
                # Keep the most recent addedAt
                if int(ep["addedAt"] or 0) > int(shows[show_name]["addedAt"] or 0):
                    episodes_count = shows[show_name]["episodes"]
                    shows[show_name] = ep
                    shows[show_name]["episodes"] = episodes_count

        # Sort by addedAt desc
        result = sorted(shows.values(), key=lambda s: int(s.get("addedAt") or 0), reverse=True)
        return jsonify({"shows": result[:20]})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/plex/trivia")
def plex_trivia():
    if not GEMINI_API_KEY:
        return jsonify({"error": "GEMINI_API_KEY not configured"}), 500
    if not PLEX_TOKEN:
        return jsonify({"error": "PLEX_TOKEN not configured"}), 500

    try:
        # Find the last watched movie from the Films library, sorted by
        # lastViewedAt. This is the item-level "watched" date, so it also
        # covers movies marked as watched (or played without a scrobbled
        # session) — which never appear in /status/sessions/history/all.
        section_key = find_plex_section("movie")
        if section_key is None:
            return jsonify({"text": None, "movie": None})

        url = (
            f"{PLEX_URL}/library/sections/{section_key}/all"
            f"?X-Plex-Token={PLEX_TOKEN}&type=1&sort=lastViewedAt:desc"
            f"&viewCount%3E=1&X-Plex-Container-Size=1"
        )
        req = urllib.request.Request(url, headers={"Accept": "application/xml"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            tree = ET.parse(resp)

        # Container-Size is best-effort on this endpoint, so take the first
        # movie entry (already sorted most-recently-viewed first).
        last_watched = tree.getroot().find("Video")
        if last_watched is None:
            return jsonify({"text": None, "movie": None})

        movie_title = last_watched.get("title")
        movie_year = last_watched.get("year", "")
        # The section listing carries Director tags directly — no extra fetch.
        directors = [d.get("tag") for d in last_watched.findall("Director")]

        # Written and fact-checked by Gemini in the background (see trivia.py): this never waits on it
        return jsonify(trivia.trivia_for({
            "key": f"{movie_title} ({movie_year})",
            "title": movie_title,
            "year": movie_year,
            "directors": directors,
        }))

    except Exception as e:
        return jsonify({"error": str(e)}), 500
