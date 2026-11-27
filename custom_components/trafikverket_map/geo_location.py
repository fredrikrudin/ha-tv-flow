"""Optional geo_location entities – one per flow site, road section, weather station and event.

Home Assistant's own map shows every geo_location entity. The setting
"Map points in Home Assistant" decides how they appear there:

* icons  – coloured symbols (entity_picture), no name labels   (default)
* names  – Home Assistant's default name labels
* hidden – no geo_location entities at all

The bundled cards do not depend on these entities: they read the same map
points through the websocket API (see websocket.py).
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.geo_location import GeolocationEvent
from homeassistant.const import UnitOfLength
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import TrafikverketConfigEntry
from .const import ATTRIBUTION, DOMAIN, ICON_URL
from .coordinator import TrafikverketCoordinator
from .mapdata import MAP_ENTITIES_HIDDEN, MAP_ENTITIES_ICONS, MapPoint, map_points
from .texts import language

_LOGGER = logging.getLogger(__name__)


class TrafikverketGeoEntity(GeolocationEvent):
    """One map point as a geo_location entity."""

    _attr_should_poll = False
    _attr_attribution = ATTRIBUTION
    _attr_unit_of_measurement = UnitOfLength.KILOMETERS
    # Big/fast-changing attributes are not written to the recorder database.
    _unrecorded_attributes = frozenset({
        "tv_key", "lanes", "lines", "measurement_time", "sample", "message", "start_time", "end_time", "web_link",
    })

    def __init__(self, entry_id: str, point: MapPoint, use_picture: bool) -> None:
        self._entry_id = entry_id
        self._use_picture = use_picture
        self._sig = ""
        self._attrs: dict[str, Any] = {}
        self._attr_source = point.source
        self.update_point(point, write=False)

    def update_point(self, point: MapPoint, write: bool = True) -> None:
        sig = point.signature()
        if sig == self._sig:
            return  # nothing changed – skip the state write
        self._sig = sig
        self._key = point.key
        self._attr_name = point.name
        self._attr_icon = point.icon
        # An entity picture replaces the name label on Home Assistant's map.
        self._attr_entity_picture = f"{ICON_URL}/{point.picture}.svg" if self._use_picture else None
        self._attr_latitude = point.latitude
        self._attr_longitude = point.longitude
        self._attr_distance = point.distance_km
        self._attrs = point.attributes
        if write and self.hass is not None:
            self.async_write_ha_state()

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"config_entry_id": self._entry_id, "tv_key": self._key, **self._attrs}


class GeoManager:
    """Adds, updates and removes geo location entities as data changes."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry_id: str,
        coordinator: TrafikverketCoordinator,
        add_entities: AddEntitiesCallback,
    ) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self.coordinator = coordinator
        self.add_entities = add_entities
        self.entities: dict[str, TrafikverketGeoEntity] = {}
        self.lang = language(hass)
        self.mode = coordinator.settings.map_entities
        # Lets the websocket API hand out real entity ids (for more-info dialogs).
        coordinator.geo_entity_ids = self.entity_ids

    def entity_ids(self) -> dict[str, str]:
        return {k: e.entity_id for k, e in self.entities.items() if e.entity_id}

    @callback
    def update(self) -> None:
        data = self.coordinator.data
        if data is None:
            return
        if self.mode == MAP_ENTITIES_HIDDEN:
            self._remove([*self.entities])
            return
        wanted = {p.key: p for p in map_points(data, self.lang)}
        new: list[TrafikverketGeoEntity] = []
        for key, point in wanted.items():
            ent = self.entities.get(key)
            if ent is None:
                ent = TrafikverketGeoEntity(self.entry_id, point, self.mode == MAP_ENTITIES_ICONS)
                self.entities[key] = ent
                new.append(ent)
            else:
                ent.update_point(point)
        if new:
            self.add_entities(new)
        self._remove([k for k in self.entities if k not in wanted])

    def _remove(self, keys: list[str]) -> None:
        for key in keys:
            ent = self.entities.pop(key)
            if ent.hass is not None:
                self.hass.async_create_task(ent.async_remove(force_remove=True))


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TrafikverketConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up geo location entities (unless turned off in the settings)."""
    coordinator = entry.runtime_data
    manager = GeoManager(hass, entry.entry_id, coordinator, async_add_entities)
    if manager.mode == MAP_ENTITIES_HIDDEN:
        _LOGGER.debug("%s: geo_location entities are turned off", DOMAIN)
    entry.async_on_unload(coordinator.async_add_listener(manager.update))
    manager.update()
