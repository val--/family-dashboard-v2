import xml.etree.ElementTree as ET

import pytest

import plex
import recaps
import trivia

LAST = [
    {"season": 1, "episode": 9, "title": "Avant", "summary": "Harry cache la vérité à Kevin."},
    {"season": 1, "episode": 10, "title": "Fin", "summary": "Kevin règle un problème. Richie prépare la guerre contre Harry."},
]


@pytest.fixture
def gemini(monkeypatch):
    """Gemini's answer, set by the test."""
    answer = {"text": ""}
    monkeypatch.setattr(trivia, "_gemini", lambda prompt, model: answer["text"])
    return answer


def test_a_recap_built_from_the_summaries_is_kept(gemini):
    gemini["text"] = "« Dans l'épisode précédent : Richie a préparé la guerre contre Harry. »"
    assert recaps.write_recap("MobLand", LAST) == "Richie a préparé la guerre contre Harry."


def test_a_recap_naming_someone_the_summaries_dont_is_refused(gemini):
    gemini["text"] = "Richie a préparé la guerre avec Conrad."
    with pytest.raises(ValueError, match="not in the summaries"):
        recaps.write_recap("MobLand", LAST)


def test_a_recap_too_long_for_the_screen_is_refused(gemini):
    gemini["text"] = "Richie a préparé la guerre. " * 20
    with pytest.raises(ValueError, match="too long"):
        recaps.write_recap("MobLand", LAST)


def test_recaps_are_written_once_in_the_background_then_kept(gemini, monkeypatch):
    monkeypatch.setattr(trivia, "GEMINI_API_KEY", "test-key")
    started = []
    monkeypatch.setattr(recaps.threading, "Thread", lambda target, args, **kw: started.append((target, args)) or type("T", (), {"start": lambda self: None})())
    gemini["text"] = "Richie a préparé la guerre contre Harry."
    assert recaps.recap_for("ep-10", "MobLand", LAST) is None  # not ready: asked in the background
    assert recaps.recap_for("ep-10", "MobLand", LAST) is None and len(started) == 1  # not asked twice
    target, args = started[0]
    target(*args)  # the background job
    assert recaps.recap_for("ep-10", "MobLand", LAST) == "Richie a préparé la guerre contre Harry."


def episodes_xml(*watched_flags):
    """A show's episodes S1E1.., watched or not, keys e1, e2..."""
    root = ET.Element("MediaContainer")
    for n, watched in enumerate(watched_flags, 1):
        season, number = (1, n) if n <= 3 else (2, n - 3)
        root.append(ET.fromstring(f'<Video ratingKey="e{n}" parentIndex="{season}" index="{number}" title="T{n}" '
                                  f'summary="Résumé {n}." {"viewCount=\"1\"" if watched else ""}/>'))
    return root


@pytest.mark.parametrize("flags, new_key, last, distance", [
    ((True, True, True, False), "e4", (1, 3), 1),  # just before, in the previous season
    ((True, True, False, False, False, False), "e6", (1, 2), 4),  # dropped a while ago
])
def test_where_the_story_was_left(monkeypatch, flags, new_key, last, distance):
    monkeypatch.setattr(plex, "_plex_xml", lambda path: episodes_xml(*flags))
    monkeypatch.setattr(plex, "_episodes_cache", {})
    monkeypatch.setattr(recaps, "recap_for", lambda key, show, context: f"recap of {key} from {len(context)}")
    before = plex.previously("show", "Série", new_key)
    assert (before["season"], before["episode"]) == last and before["distance"] == distance
    assert before["recap"].startswith(f"recap of e{flags.index(False)}")


def test_nothing_before_when_no_episode_was_watched_before_it(monkeypatch):
    monkeypatch.setattr(plex, "_plex_xml", lambda path: episodes_xml(False, False, True))
    monkeypatch.setattr(plex, "_episodes_cache", {})
    assert plex.previously("show", "Série", "e2") is None
