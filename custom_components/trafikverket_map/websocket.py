"""Websocket API used by the bundled cards.

``trafikverket_map/map_data`` returns the map points of one location in the
same shape as Home Assistant state objects. The cards use it instead of the
geo_location entities, so they keep working when those are turned off
("Map points in Home Assistant: Hidden").
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .mapdata import map_points, point_payload
from .schema_lib import vol as schema_lib
from .texts import language

_LOGGER = logging.getLogger(__name__)

WS_MAP_DATA = f"{DOMAIN}/map_data"
WS_POINT_HISTORY = f"{DOMAIN}/point_history"


@callback
def async_register(hass: HomeAssistant) -> None:
    """Register the command. A failure here must never stop the cards from loading."""
    try:
        websocket_api.async_register_command(hass, ws_map_data)
        websocket_api.async_register_command(hass, ws_point_history)
    except Exception:  # noqa: BLE001
        _LOGGER.exception("Could not register the websocket command %s", WS_MAP_DATA)


# The schema must use the same library as the running Home Assistant version,
# otherwise the integration fails to load (and with it all cards).
@websocket_api.websocket_command({
    schema_lib.Required("type"): WS_MAP_DATA,
    schema_lib.Optional("entry_id"): str,
})
@callback
def ws_map_data(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Return the map points of a location (the first one if no entry_id is given)."""
    entries = [e for e in hass.config_entries.async_entries(DOMAIN) if getattr(e, "runtime_data", None) is not None]
    entry_id = msg.get("entry_id")
    if entry_id:
        entries = [e for e in entries if e.entry_id == entry_id]
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


def _entry(hass: HomeAssistant, entry_id: str | None):
    entries = [e for e in hass.config_entries.async_entries(DOMAIN) if getattr(e, "runtime_data", None) is not None]
    if entry_id:
        entries = [e for e in entries if e.entry_id == entry_id]
    return entries[0] if entries else None


@websocket_api.websocket_command({
    schema_lib.Required("type"): WS_POINT_HISTORY,
    schema_lib.Required("key"): str,
    schema_lib.Optional("entry_id"): str,
})
@callback
def ws_point_history(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Speed history of one flow map point (in memory, the last 24 hours)."""
    entry = _entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(msg["id"], "not_found", "No Trafikverket Trafikkarta location found")
        return
    connection.send_result(msg["id"], {"key": msg["key"], "items": entry.runtime_data.speed_history.get(msg["key"])})
