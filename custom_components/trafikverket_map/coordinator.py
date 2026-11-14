"""Data update coordinator for Trafikverket Trafikkarta."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_API_KEY, CONF_LATITUDE, CONF_LONGITUDE
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import TrafikverketAuthError, TrafikverketClient, TrafikverketError
from .const import (
    CONF_ENABLE_FLOW,
    CONF_ENABLE_ROAD,
    CONF_ENABLE_SITUATION,
    CONF_ENABLE_WEATHER,
    CONF_DASHBOARD_SECTIONS,
    CONF_MAP_HEIGHT,
    CONF_MAP_STYLE,
    CONF_MAX_AGE,
    CONF_MAX_OBJECTS,
    CONF_MINIMAL_FIELDS,
    CONF_RADIUS,
    CONF_SCAN_INTERVAL,
    CONF_WEATHER_RADIUS,
    DASHBOARD_SECTIONS,
    DEFAULT_MAP_HEIGHT,
    DEFAULT_MAP_STYLE,
    DEFAULT_MAX_AGE_MIN,
    DEFAULT_MAX_OBJECTS,
    DEFAULT_RADIUS_KM,
    DEFAULT_SCAN_INTERVAL_MIN,
    DEFAULT_WEATHER_RADIUS_KM,
    DOMAIN,
)
from .parser import TrafikverketData

_LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class Settings:
    """Effective settings (options override data)."""

    latitude: float
    longitude: float
    radius_km: float
    weather_radius_km: float
    scan_interval_min: int
    flow: bool
    road: bool
    weather: bool
    situation: bool
    max_objects: int
    minimal_fields: bool
    max_age_min: int
    map_style: str
    dashboard_sections: tuple[str, ...]
    map_height: int

    @classmethod
    def from_entry(cls, hass: HomeAssistant, entry: ConfigEntry) -> Settings:
        def get(key: str, default: Any) -> Any:
            return entry.options.get(key, entry.data.get(key, default))

        return cls(
            latitude=float(get(CONF_LATITUDE, hass.config.latitude)),
            longitude=float(get(CONF_LONGITUDE, hass.config.longitude)),
            radius_km=float(get(CONF_RADIUS, DEFAULT_RADIUS_KM)),
            weather_radius_km=float(get(CONF_WEATHER_RADIUS, DEFAULT_WEATHER_RADIUS_KM)),
            scan_interval_min=int(get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL_MIN)),
            flow=bool(get(CONF_ENABLE_FLOW, True)),
            road=bool(get(CONF_ENABLE_ROAD, True)),
            weather=bool(get(CONF_ENABLE_WEATHER, True)),
            situation=bool(get(CONF_ENABLE_SITUATION, True)),
            max_objects=int(get(CONF_MAX_OBJECTS, DEFAULT_MAX_OBJECTS)),
            minimal_fields=bool(get(CONF_MINIMAL_FIELDS, True)),
            max_age_min=int(get(CONF_MAX_AGE, DEFAULT_MAX_AGE_MIN)),
            map_style=str(get(CONF_MAP_STYLE, DEFAULT_MAP_STYLE)),
            dashboard_sections=tuple(
                s for s in get(CONF_DASHBOARD_SECTIONS, DASHBOARD_SECTIONS) if s in DASHBOARD_SECTIONS
            ) or tuple(DASHBOARD_SECTIONS),
            map_height=int(get(CONF_MAP_HEIGHT, DEFAULT_MAP_HEIGHT)),
        )


class TrafikverketCoordinator(DataUpdateCoordinator[TrafikverketData]):
    """Fetch all Trafikverket data in a single request per interval."""

    config_entry: ConfigEntry

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.settings = Settings.from_entry(hass, entry)
        super().__init__(
            hass,
            _LOGGER,
            config_entry=entry,
            name=DOMAIN,
            update_interval=timedelta(minutes=self.settings.scan_interval_min),
        )
        self.client = TrafikverketClient(
            async_get_clientsession(hass), entry.data[CONF_API_KEY]
        )
        self.total_bytes = 0
        self.request_count = 0

    async def _async_update_data(self) -> TrafikverketData:
        s = self.settings
        try:
            data = await self.client.async_fetch(
                s.latitude,
                s.longitude,
                s.radius_km,
                s.weather_radius_km,
                flow=s.flow,
                road=s.road,
                weather=s.weather,
                situation=s.situation,
                limit=s.max_objects,
                minimal=s.minimal_fields,
                max_age=timedelta(minutes=s.max_age_min),
            )
        except TrafikverketAuthError as err:
            raise ConfigEntryAuthFailed(str(err)) from err
        except TrafikverketError as err:
            raise UpdateFailed(str(err)) from err
        self.total_bytes += data.response_bytes
        self.request_count += 1
        return data
