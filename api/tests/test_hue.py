import pytest

import hue

ROOM, GROUP, DEVICE, LIGHT, SCENE = (f"{n:08d}-0000-4000-8000-000000000000" for n in range(1, 6))

BRIDGE = {
    "room": [{"id": ROOM, "metadata": {"name": "Salon"}, "children": [{"rid": DEVICE, "rtype": "device"}],
              "services": [{"rid": GROUP, "rtype": "grouped_light"}]}],
    "device": [{"id": DEVICE, "services": [{"rid": LIGHT, "rtype": "light"}, {"rid": "x", "rtype": "zigbee_connectivity"}]}],
    "light": [{"id": LIGHT, "metadata": {"name": "Lampadaire"}, "on": {"on": True}, "dimming": {"brightness": 49.4},
               "color": {"xy": {"x": 0.5, "y": 0.41}}, "color_temperature": {"mirek": 366, "mirek_valid": True}}],
    "grouped_light": [{"id": GROUP, "on": {"on": True}, "dimming": {"brightness": 49.4}}],
    "scene": [
        {"id": SCENE, "group": {"rid": ROOM}, "metadata": {"name": "Détente"}, "status": {"active": "static"},
         "palette": {"color": [], "color_temperature": [{"color_temperature": {"mirek": 447}}]}},
        {"id": "s2", "group": {"rid": ROOM}, "metadata": {"name": "Aurore"}, "status": {"active": "inactive"},
         "palette": {"color": [{"color": {"xy": {"x": 0.17, "y": 0.7}}}, {"color": {"xy": {"x": 0.15, "y": 0.06}}}]}},
        {"id": "s3", "group": {"rid": "another-room"}, "metadata": {"name": "Ailleurs"}},
    ],
}


@pytest.fixture
def bridge(monkeypatch):
    """A fake bridge: answers from BRIDGE, records what the API asks it to change."""
    calls = []

    def fake_call(method, resource, body=None):
        calls.append((method, resource, body))
        if method == "GET":
            return BRIDGE[resource]
        return [{"rid": resource.split("/")[-1]}]

    monkeypatch.setattr(hue, "HUE_BRIDGE_IP", "10.0.0.2")
    monkeypatch.setattr(hue, "HUE_APP_KEY", "test-key")
    monkeypatch.setattr(hue, "_call", fake_call)
    hue._forget()
    return calls


def test_rooms_come_with_their_lights_and_scenes(client, bridge):
    rooms = client.get("/api/hue").get_json()["rooms"]
    assert len(rooms) == 1
    salon = rooms[0]
    assert salon["name"] == "Salon" and salon["group"] == GROUP and salon["on"] is True and salon["brightness"] == 49
    assert [light["name"] for light in salon["lights"]] == ["Lampadaire"]
    assert salon["lights"][0]["color"].startswith("#")
    # sorted by name, only this room's, the active one flagged
    assert [(s["name"], s["active"]) for s in salon["scenes"]] == [("Aurore", False), ("Détente", True)]
    assert len(salon["scenes"][0]["colors"]) == 2


def test_the_bridge_is_read_once_for_a_burst_of_calls(client, bridge):
    client.get("/api/hue")
    client.get("/api/hue")
    assert sum(1 for method, *_ in bridge if method == "GET") == 5  # room, device, light, grouped_light, scene


def test_switching_a_light_and_a_room(client, bridge):
    assert client.put(f"/api/hue/lights/{LIGHT}", json={"on": False}).status_code == 200
    assert client.put(f"/api/hue/groups/{GROUP}", json={"brightness": 30}).status_code == 200
    assert ("PUT", f"light/{LIGHT}", {"on": {"on": False}}) in bridge
    assert ("PUT", f"grouped_light/{GROUP}", {"dimming": {"brightness": 30.0}}) in bridge


def test_recalling_a_scene(client, bridge):
    assert client.post(f"/api/hue/scenes/{SCENE}/recall").status_code == 200
    assert ("PUT", f"scene/{SCENE}", {"recall": {"action": "active"}}) in bridge


@pytest.mark.parametrize("path, body", [
    (f"/api/hue/lights/{LIGHT}", {"on": "yes"}),  # not a boolean
    (f"/api/hue/lights/{LIGHT}", {"brightness": 0}),
    (f"/api/hue/lights/{LIGHT}", {"brightness": 101}),
    (f"/api/hue/lights/{LIGHT}", {"brightness": True}),  # True == 1 in Python
    (f"/api/hue/lights/{LIGHT}", {"color": "red"}),  # nothing we allow
    ("/api/hue/lights/..%2Fconfig", {"on": True}),  # only bridge ids
])
def test_bad_requests_never_reach_the_bridge(client, bridge, path, body):
    assert client.put(path, json=body).status_code in (400, 404)
    assert not any(method == "PUT" for method, *_ in bridge)


def test_an_unreachable_bridge_is_reported(client, monkeypatch):
    def down(*_args, **_kwargs):
        raise hue.HueError("pont Hue injoignable")

    monkeypatch.setattr(hue, "HUE_BRIDGE_IP", "10.0.0.2")
    monkeypatch.setattr(hue, "HUE_APP_KEY", "test-key")
    monkeypatch.setattr(hue, "_call", down)
    hue._forget()
    res = client.get("/api/hue")
    assert res.status_code == 502 and "injoignable" in res.get_json()["error"]


def test_off_without_settings(client, monkeypatch):
    monkeypatch.setattr(hue, "HUE_APP_KEY", "")
    assert client.get("/api/hue").status_code == 503


def test_colors():
    assert hue.xy_to_hex(0.7, 0.3).startswith("#ff")  # a red
    assert int(hue.mirek_to_hex(153)[5:], 16) > 240  # a cold white: blue nearly full
    assert len(hue.mirek_to_hex(450)) == 7 and hue.mirek_to_hex(450).startswith("#ff")  # warm white: red at full
