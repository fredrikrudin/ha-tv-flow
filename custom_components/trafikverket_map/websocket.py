"""Websocket API used by the bundled cards.

``trafikverket_map/map_data`` returns the map points of one location in the
same shape as Home Assistant state objects. The cards use it instead of the
geo_location entities, so they keep working when those are turned off
("Map points in Home Assistant: Hidden").
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .mapdata import map_points, point_payload
from .texts import language

WS_MAP_DATA = f"{DOMAIN}/map_data"


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_map_data)


@websocket_api.websocket_command({
    vol.Required("type"): WS_MAP_DATA,
    vol.Optional("entry_id"): str,
})
@callback
def ws_map_data(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Return the map points of a location (the first one if no entry_id is given)."""
    entries = [e for e in hass.config_entries.async_entries(DOMAIN) if getattr(e, "runtime_data", None) is not None]
    if msg.get("entry_id"):
        entries = [e for e in entries if e.entry_id == msg["entry_id"]]
    if not entries:
        connection.send_error(msg["id"], "not_found", "No Trafikverket Trafikkarta location found")
        return
    entry = entries[0]
    coordinator = entry.runtime_data
    lang = language(hass)
    entity_ids = coordinator.geo_entity_ids()
    data = coordinator.data
    connection.send_result(msg["id"], {
        "entry_id": entry.entry_id,
        "fetched_at": data.fetched_at.isoformat() if data and data.fetched_at else None,
        "items": [point_payload(p, entry.entry_id, entity_ids.get(p.key)) for p in map_points(data, lang)],
    })
