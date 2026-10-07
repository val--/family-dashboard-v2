import json

import settings


def test_defaults_when_nothing_is_stored(client):
    assert client.get("/api/settings").get_json() == {key: default for key, (default, _) in settings.SCHEMA.items()}


def test_a_valid_change_is_stored_and_kept(client):
    res = client.put("/api/settings", json={"idleMinutes": 15, "postitRange": "all"})
    assert res.status_code == 200
    assert res.get_json()["idleMinutes"] == 15
    again = client.get("/api/settings").get_json()
    assert again["idleMinutes"] == 15 and again["postitRange"] == "all"
    assert again["movieDays"] == 3  # untouched keys keep their default


def test_values_outside_the_allowed_list_are_refused(client):
    assert client.put("/api/settings", json={"idleMinutes": 7}).status_code == 400
    assert client.put("/api/settings", json={"movieDays": "3"}).status_code == 400
    assert client.get("/api/settings").get_json()["idleMinutes"] == 5


def test_booleans_are_not_taken_for_numbers(client):
    # True == 1 in Python: without the explicit check it would pass as "1 minute"
    assert client.put("/api/settings", json={"idleMinutes": True}).status_code == 400


def test_unknown_keys_are_refused(client):
    assert client.put("/api/settings", json={"theme": "dark"}).status_code == 400


def test_a_hand_edited_file_with_bad_values_falls_back_to_defaults():
    with open(settings.SETTINGS_FILE, "w") as f:
        json.dump({"idleMinutes": 42, "postitSeconds": 60}, f)
    loaded = settings.load()
    assert loaded["idleMinutes"] == 5  # not allowed: default
    assert loaded["postitSeconds"] == 60  # allowed: kept


SCENE_A = "00000001-0000-4000-8000-000000000000"
SCENE_B = "00000002-0000-4000-8000-000000000000"


def test_light_shortcuts_are_up_to_four_different_scene_ids(client):
    assert client.put("/api/settings", json={"lightShortcuts": [SCENE_A, SCENE_B]}).status_code == 200
    assert client.get("/api/settings").get_json()["lightShortcuts"] == [SCENE_A, SCENE_B]
    assert client.put("/api/settings", json={"lightShortcuts": []}).status_code == 200
    four = [f"0000000{n}-0000-4000-8000-000000000000" for n in range(1, 5)]
    assert client.put("/api/settings", json={"lightShortcuts": four}).status_code == 200
    for bad in ([SCENE_A] * 2, four + ["00000005-0000-4000-8000-000000000000"],
                ["../../etc"], SCENE_A, [1]):
        assert client.put("/api/settings", json={"lightShortcuts": bad}).status_code == 400
