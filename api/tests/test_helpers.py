import io
import xml.etree.ElementTree as ET
from datetime import date

import pytest

import arr
import plex
import recalbox
import sorties
import trivia


# ---- Outings: which weekend, and the agenda's ways of saying "all day"


@pytest.mark.parametrize("today, saturday", [
    (date(2026, 10, 5), date(2026, 10, 10)),  # Monday: the coming weekend
    (date(2026, 10, 9), date(2026, 10, 10)),  # Friday
    (date(2026, 10, 10), date(2026, 10, 10)),  # Saturday: this one
    (date(2026, 10, 11), date(2026, 10, 10)),  # Sunday: still this one
])
def test_next_weekend(today, saturday):
    assert sorties.next_weekend(today) == (saturday, date(saturday.year, saturday.month, saturday.day + 1))


@pytest.mark.parametrize("start, end, all_day", [
    (None, None, True),
    ("00:00", None, True),
    ("00:00", "23:59", True),
    ("00:00", "12:00", False),
    ("20:30", "22:00", False),
])
def test_all_day_events(start, end, all_day):
    event = sorties.parse_nantes_event({"id_manif": 1, "date": "2026-10-10", "nom": "Concert", "heure_debut": start, "heure_fin": end})
    assert event["allDay"] is all_day
    assert event["start"] == (None if all_day else start)


def test_postponed_events_and_placeholder_places_are_dropped():
    assert sorties.parse_nantes_event({"date": "2026-10-10", "reporte": "oui"}) is None
    event = sorties.parse_nantes_event({"id_manif": 2, "date": "2026-10-10", "lieu": ".", "ville": "Nantes", "adresse": ".",
                                        "description": "<p>Un <b>très</b> bon\n moment</p>"})
    assert event["place"] == "Nantes" and event["address"] is None
    assert event["description"] == "Un très bon moment"


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
