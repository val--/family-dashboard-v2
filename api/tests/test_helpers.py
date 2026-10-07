import io
import time
import xml.etree.ElementTree as ET

import arr
import plex
import recalbox
import trivia


# ---- Radarr / Sonarr


def test_poster_url():
    assert arr.poster_url({"images": [{"coverType": "fanart", "remoteUrl": "f"}, {"coverType": "poster", "remoteUrl": "p"}]}) == "p"
    assert arr.poster_url({}) is None


# ---- Trivia: the code check after the AI one


def test_every_number_and_name_must_be_in_the_extract():
    source = "Le tournage a duré 112 jours à Montréal, sous la direction de Denis Villeneuve."
    assert trivia.details_in_source("Le tournage a duré 112 jours à Montréal.", source)
    assert not trivia.details_in_source("Le tournage a duré 113 jours.", source)  # wrong number
    assert not trivia.details_in_source("Il a été tourné à Toronto.", source)  # name not in the extract


def test_accents_and_case_dont_matter_for_names():
    assert trivia.details_in_source("Une scène tournée à MONTREAL.", "tourné à Montréal")


# ---- Recalbox


def test_recalbox_system_info():
    info = {
        "cpus": {"0": {"consumption": [10.0]}, "1": {"consumption": [30.0]}},
        "memory": {"total": 4000, "available": [1000]},
        "temperature": {"temperatures": [51.6]},
    }
    assert recalbox.parse_system_info(info) == {
        "cpu": 20.0,
        "memory": {"total": 4000, "used": 3000, "percent": 75.0},
        "temperature": 52,
    }
    assert recalbox.parse_system_info({}) == {"cpu": None, "memory": None, "temperature": None}


# ---- Plex


MOVIE_XML = """
<Video ratingKey="42" type="movie" title="Drive" year="2011" duration="6000000" addedAt="1790000000"
       thumb="/library/metadata/42/thumb/1" art="/library/metadata/42/art/1" viewCount="1">
  <Genre tag="Drame"/><Genre tag="Thriller"/><Director tag="Nicolas Winding Refn"/>
  <Role tag="Ryan Gosling"/><Role tag="Carey Mulligan"/>
</Video>
"""


def test_movie_parsing_and_resized_images():
    movie = plex.parse_plex_movie(ET.fromstring(MOVIE_XML))
    assert movie["key"] == "42" and movie["title"] == "Drive" and movie["duration"] == 100
    assert movie["genres"] == ["Drame", "Thriller"] and movie["actors"] == ["Ryan Gosling", "Carey Mulligan"]
    assert movie["watched"] is True
    # posters and backdrops go through Plex's resizer, on its public address
    assert movie["thumb"].startswith("http://plex.example:32400/photo/:/transcode?width=400&height=600")
    assert "&blur=8" in movie["art"] and "width=640&height=360" in movie["art"]
    assert "blur" not in movie["thumb"]


def test_library_sections_are_looked_up_once(monkeypatch):
    calls = []

    def fake_urlopen(req, timeout=None):
        calls.append(req.full_url)
        return io.BytesIO(b'<MediaContainer><Directory type="movie" key="1"/><Directory type="show" key="2"/></MediaContainer>')

    monkeypatch.setattr(plex.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(plex, "_section_cache", {})
    assert plex.find_plex_section("movie") == "1"
    assert plex.find_plex_section("movie") == "1"
    assert len(calls) == 1
    assert plex.find_plex_section("show") == "2"
    assert plex.find_plex_section("music") is None
    assert plex.find_plex_section("music") is None  # not found: asked again, never cached
    assert len(calls) == 4


# ---- New episodes for the screensaver


def episode_xml(show_key, show, season, number, days_ago, watched=False):
    added = int(time.time() - days_ago * 86400)
    return ET.fromstring(
        f'<Video type="episode" ratingKey="{show_key}{season}{number}" grandparentRatingKey="{show_key}" '
        f'grandparentTitle="{show}" parentIndex="{season}" index="{number}" title="Épisode {number}" addedAt="{added}" '
        f'summary="Ce qui se passe (spoiler)" grandparentThumb="/t/{show_key}" grandparentArt="/a/{show_key}" '
        f'{"viewCount=\"1\"" if watched else ""}/>'
    )


def test_new_episodes_only_for_started_shows_and_without_spoilers(client, monkeypatch):
    recently_added = ET.Element("MediaContainer")
    recently_added.extend([
        episode_xml("10", "Started", 2, 3, 1),
        episode_xml("10", "Started", 2, 2, 2),
        episode_xml("10", "Started", 2, 1, 20),  # older than two weeks: not counted
        episode_xml("20", "Never watched", 1, 2, 1),
        episode_xml("30", "Seen already", 1, 5, 3, watched=True),
    ])
    shows = {
        "10": ET.fromstring('<MediaContainer><Directory viewedLeafCount="10" summary="A show."/></MediaContainer>'),
        "20": ET.fromstring('<MediaContainer><Directory viewedLeafCount="0" summary="Another."/></MediaContainer>'),
        "30": ET.fromstring('<MediaContainer><Directory viewedLeafCount="5" summary="A third."/></MediaContainer>'),
    }

    def fake_xml(path):
        if "recentlyAdded" in path:
            return recently_added
        if path.endswith("/allLeaves"):  # the show's episodes: none watched before the new ones here
            return ET.Element("MediaContainer")
        return shows[path.rsplit("/", 1)[-1]]

    monkeypatch.setattr(plex, "_plex_xml", fake_xml)
    monkeypatch.setattr(plex, "find_plex_section", lambda kind: "2")
    monkeypatch.setattr(plex, "_show_cache", {})
    episodes = client.get("/api/plex/new-episodes").get_json()["episodes"]

    assert [(e["show"], e["season"], e["episode"]) for e in episodes] == [("Started", 2, 3), ("Seen already", 1, 5)]
    started, seen = episodes
    assert len(started["addedTimes"]) == 2  # the 20-day-old one is out of the window
    assert started["summary"] is None and started["showSummary"] == "A show."  # not watched: no spoiler
    assert seen["summary"] == "Ce qui se passe (spoiler)"  # watched: its summary is fine
    assert "/t/10" in started["thumb"].replace("%2F", "/")  # the show's poster, not a still of the episode


# ---- The last movie watched, with its anecdotes


def test_last_watched_movie_comes_with_its_anecdotes(client, monkeypatch):
    video = ET.fromstring(MOVIE_XML.replace('viewCount="1"', 'viewCount="1" lastViewedAt="1790000000"'))
    monkeypatch.setattr(plex, "last_watched_movie", lambda: video)
    monkeypatch.setattr(plex, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(trivia, "trivia_for", lambda movie: {"text": "A ★ B", "movie": movie["key"],
                                                            "items": [{"text": "Anecdote A", "site": "allocine"}]})
    movie = client.get("/api/plex/last-watched").get_json()["movie"]
    assert movie["title"] == "Drive" and movie["lastViewedAt"] == 1790000000
    assert movie["anecdotes"] == ["Anecdote A"]


def test_no_movie_watched_yet(client, monkeypatch):
    monkeypatch.setattr(plex, "last_watched_movie", lambda: None)
    assert client.get("/api/plex/last-watched").get_json() == {"movie": None}
