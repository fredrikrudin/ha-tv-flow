"""Geo location entities – one per flow site, road condition segment and weather station.

These show up on Home Assistant's built-in map card (geo_location_sources) and
are what the bundled ``trafikverket-map-card`` draws.
"""

from __future__ import annotations

from collections.abc import Callable
import logging
from typing import Any

from homeassistant.components.geo_location import GeolocationEvent
from homeassistant.const import UnitOfLength
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import TrafikverketConfigEntry
from .const import ATTRIBUTION, SOURCE_FLOW, SOURCE_ROAD, SOURCE_WEATHER
from .coordinator import TrafikverketCoordinator
from .parser import PRECIPITATION_TEXT, FlowSite, RoadConditionItem, WeatherStation

_LOGGER = logging.getLogger(__name__)


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


class TrafikverketGeoEntity(GeolocationEvent):
    """Base geo location entity fed by the coordinator."""

    _attr_should_poll = False
    _attr_attribution = ATTRIBUTION
    _attr_unit_of_measurement = UnitOfLength.KILOMETERS
    # Big/fast-changing attributes are not written to the recorder database.
    _unrecorded_attributes = frozenset({"lanes", "lines", "measurement_time", "sample"})

    def __init__(self, entry_id: str, key: str, item: Any) -> None:
        self._entry_id = entry_id
        self._key = key
        self._attrs: dict[str, Any] = {}
        self.update_item(item, write=False)

    def update_item(self, item: Any, write: bool = True) -> None:
        raise NotImplementedError

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"config_entry_id": self._entry_id, **self._attrs}

    def _set_pos(self, lat: float, lon: float, dist: float) -> None:
        self._attr_latitude = lat
        self._attr_longitude = lon
        self._attr_distance = dist

    def _write(self, write: bool) -> None:
        if write and self.hass is not None:
            self.async_write_ha_state()


class FlowEntity(TrafikverketGeoEntity):
    """Traffic flow measurement site."""

    _attr_source = SOURCE_FLOW

    def update_item(self, item: FlowSite, write: bool = True) -> None:
        self._attr_name = f"Trafikflöde {item.site_id}"
        speed = item.average_speed
        if speed is None:
            self._attr_icon = "mdi:car-off"
        elif speed < 30:
            self._attr_icon = "mdi:car-multiple"
        else:
            self._attr_icon = "mdi:car-speed-limiter"
        self._set_pos(item.latitude, item.longitude, item.distance_km)
        self._attrs = {
            "tv_type": "flow",
            "site_id": item.site_id,
            "flow": item.total_flow,
            "flow_unit": "fordon/h",
            "average_speed": item.average_speed,
            "min_speed": item.min_speed,
            "speed_unit": "km/h",
            "data_quality": item.data_quality,
            "period_s": item.period_s,
            "measurement_time": _iso(item.measurement_time),
            "lanes": item.lanes,
        }
        self._write(write)


class RoadEntity(TrafikverketGeoEntity):
    """Road condition segment."""

    _attr_source = SOURCE_ROAD

    def update_item(self, item: RoadConditionItem, write: bool = True) -> None:
        road = item.road_number or "Väg"
        self._attr_name = f"Väglag {road} {item.id[-6:]}"
        self._attr_icon = {
            1: "mdi:road-variant",
            2: "mdi:alert-outline",
            3: "mdi:alert",
            4: "mdi:snowflake-alert",
        }.get(item.code or 0, "mdi:road")
        self._set_pos(item.latitude, item.longitude, item.distance_km)
        self._attrs = {
            "tv_type": "road",
            "condition_code": item.code,
            "condition_text": item.text,
            "condition_info": item.info,
            "cause": item.cause,
            "warning": item.warning,
            "measure": item.measure,
            "location_text": item.location_text,
            "road_number": item.road_number,
            "start_time": _iso(item.start_time),
            "end_time": _iso(item.end_time),
            "lines": item.lines,
        }
        self._write(write)


class WeatherStationEntity(TrafikverketGeoEntity):
    """Road weather station."""

    _attr_source = SOURCE_WEATHER
    _attr_icon = "mdi:weather-partly-cloudy"

    def update_item(self, item: WeatherStation, write: bool = True) -> None:
        self._attr_name = f"Väderstation {item.name}"
        self._set_pos(item.latitude, item.longitude, item.distance_km)
        self._attrs = {
            "tv_type": "weather",
            "station": item.name,
            "air_temperature": item.air_temperature,
            "surface_temperature": item.surface_temperature,
            "humidity": item.humidity,
            "dewpoint": item.dewpoint,
            "wind_speed": item.wind_speed,
            "wind_gust": item.wind_gust,
            "wind_direction": item.wind_direction,
            "precipitation": item.precipitation,
            "precipitation_text": PRECIPITATION_TEXT.get(item.precipitation or "", item.precipitation),
            "precipitation_30min": item.precipitation_30min,
            "visibility": item.visibility,
            "grip": item.grip,
            "ice": item.ice,
            "snow": item.snow,
            "sample": _iso(item.sample),
        }
        self._write(write)


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

    @callback
    def update(self) -> None:
        data = self.coordinator.data
        if data is None:
            return
        wanted: dict[str, tuple[type[TrafikverketGeoEntity], Any]] = {}
        for site in data.flow_sites:
            wanted[f"flow_{site.site_id}"] = (FlowEntity, site)
        for rc in data.road_conditions:
            wanted[f"road_{rc.id}"] = (RoadEntity, rc)
        for ws in data.weather_stations:
            wanted[f"weather_{ws.station_id or ws.id}"] = (WeatherStationEntity, ws)

        new: list[TrafikverketGeoEntity] = []
        for key, (cls, item) in wanted.items():
            ent = self.entities.get(key)
            if ent is None:
                ent = cls(self.entry_id, key, item)
                self.entities[key] = ent
                new.append(ent)
            else:
                ent.update_item(item)
        if new:
            self.add_entities(new)

        for key in [k for k in self.entities if k not in wanted]:
            ent = self.entities.pop(key)
            if ent.hass is not None:
                self.hass.async_create_task(ent.async_remove(force_remove=True))

    async def async_remove_all(self) -> None:
        for ent in list(self.entities.values()):
            if ent.hass is not None:
                await ent.async_remove(force_remove=True)
        self.entities.clear()


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TrafikverketConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up geo location entities."""
    coordinator = entry.runtime_data
    manager = GeoManager(hass, entry.entry_id, coordinator, async_add_entities)
    entry.async_on_unload(coordinator.async_add_listener(manager.update))
    manager.update()
