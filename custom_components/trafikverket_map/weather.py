"""Local weather from the nearest Trafikverket road weather station."""

from __future__ import annotations

from homeassistant.components.weather import WeatherEntity
from homeassistant.const import UnitOfLength, UnitOfPrecipitationDepth, UnitOfSpeed, UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import TrafikverketConfigEntry
from .const import ATTRIBUTION, DOMAIN, NAME
from .coordinator import TrafikverketCoordinator
from .parser import PRECIPITATION_TEXT, WeatherStation

# Trafikverket reports precipitation type but not cloud cover.
_CONDITION = {
    "rain": "rainy",
    "freezing_rain": "snowy-rainy",
    "sleet": "snowy-rainy",
    "snow": "snowy",
    "yes": "rainy",
}


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TrafikverketConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator = entry.runtime_data
    if coordinator.settings.weather:
        async_add_entities([TrafikverketWeather(coordinator, entry)])


class TrafikverketWeather(CoordinatorEntity[TrafikverketCoordinator], WeatherEntity):
    """Current observation from the closest station (no forecast)."""

    _attr_has_entity_name = True
    _attr_translation_key = "local_weather"
    _attr_attribution = ATTRIBUTION
    _attr_native_temperature_unit = UnitOfTemperature.CELSIUS
    _attr_native_wind_speed_unit = UnitOfSpeed.METERS_PER_SECOND
    _attr_native_visibility_unit = UnitOfLength.METERS
    _attr_native_precipitation_unit = UnitOfPrecipitationDepth.MILLIMETERS

    def __init__(self, coordinator: TrafikverketCoordinator, entry: TrafikverketConfigEntry) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_weather"
        self.entity_id = "weather.tv_flow"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            manufacturer="Trafikverket",
            model=NAME,
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def _w(self) -> WeatherStation | None:
        return self.coordinator.data.nearest_weather if self.coordinator.data else None

    @property
    def available(self) -> bool:
        return super().available and self._w is not None

    @property
    def condition(self) -> str | None:
        w = self._w
        if w is None:
            return None
        if w.precipitation in _CONDITION:
            return _CONDITION[w.precipitation]
        if w.visibility is not None and w.visibility < 1000:
            return "fog"
        if w.wind_speed is not None and w.wind_speed >= 14:
            return "windy"
        return "cloudy" if (w.humidity or 0) >= 95 else "partlycloudy"

    @property
    def native_temperature(self) -> float | None:
        return self._w.air_temperature if self._w else None

    @property
    def native_dew_point(self) -> float | None:
        return self._w.dewpoint if self._w else None

    @property
    def humidity(self) -> float | None:
        return self._w.humidity if self._w else None

    @property
    def native_wind_speed(self) -> float | None:
        return self._w.wind_speed if self._w else None

    @property
    def native_wind_gust_speed(self) -> float | None:
        return self._w.wind_gust if self._w else None

    @property
    def wind_bearing(self) -> float | None:
        return self._w.wind_direction if self._w else None

    @property
    def native_visibility(self) -> float | None:
        return self._w.visibility if self._w else None

    @property
    def extra_state_attributes(self) -> dict:
        w = self._w
        if not w:
            return {}
        return {
            "station": w.name,
            "distance_km": w.distance_km,
            "surface_temperature": w.surface_temperature,
            "precipitation": PRECIPITATION_TEXT.get(w.precipitation or "", w.precipitation),
            "precipitation_30min_mm": w.precipitation_30min,
            "grip": w.grip,
            "sample": w.sample.isoformat() if w.sample else None,
        }
