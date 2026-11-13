"""Summary sensors for Trafikverket Trafikkarta."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import (
    DEGREE,
    PERCENTAGE,
    EntityCategory,
    UnitOfInformation,
    UnitOfLength,
    UnitOfPrecipitationDepth,
    UnitOfSpeed,
    UnitOfTemperature,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import TrafikverketConfigEntry
from .const import ATTRIBUTION, DOMAIN, NAME
from .coordinator import TrafikverketCoordinator
from .parser import PRECIPITATION_TEXT, ROAD_CONDITION_TEXT, TrafikverketData


def _avg_speed(d: TrafikverketData) -> float | None:
    pairs = [(s.average_speed, max(s.total_flow, 1)) for s in d.flow_sites if s.average_speed]
    if not pairs:
        return None
    return round(sum(v * w for v, w in pairs) / sum(w for _, w in pairs), 1)


def _min_speed(d: TrafikverketData) -> float | None:
    speeds = [s.average_speed for s in d.flow_sites if s.average_speed]
    return min(speeds) if speeds else None


def _worst_code(d: TrafikverketData) -> int | None:
    codes = [r.code for r in d.road_conditions if r.code]
    return max(codes) if codes else None


def _w(attr: str) -> Callable[[TrafikverketData], Any]:
    def fn(d: TrafikverketData) -> Any:
        w = d.nearest_weather
        return getattr(w, attr) if w else None
    return fn


@dataclass(frozen=True, kw_only=True)
class TvSensorDescription(SensorEntityDescription):
    value_fn: Callable[[TrafikverketData], Any]
    group: str = "flow"  # flow | road | weather | meta


SENSORS: tuple[TvSensorDescription, ...] = (
    TvSensorDescription(
        key="flow_sites", translation_key="flow_sites", icon="mdi:map-marker-multiple",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda d: len(d.flow_sites),
    ),
    TvSensorDescription(
        key="total_flow", translation_key="total_flow", icon="mdi:car-multiple",
        native_unit_of_measurement="fordon/h", state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda d: sum(s.total_flow for s in d.flow_sites) if d.flow_sites else None,
    ),
    TvSensorDescription(
        key="average_speed", translation_key="average_speed", icon="mdi:speedometer",
        device_class=SensorDeviceClass.SPEED, native_unit_of_measurement=UnitOfSpeed.KILOMETERS_PER_HOUR,
        state_class=SensorStateClass.MEASUREMENT, value_fn=_avg_speed,
    ),
    TvSensorDescription(
        key="lowest_speed", translation_key="lowest_speed", icon="mdi:speedometer-slow",
        device_class=SensorDeviceClass.SPEED, native_unit_of_measurement=UnitOfSpeed.KILOMETERS_PER_HOUR,
        state_class=SensorStateClass.MEASUREMENT, value_fn=_min_speed,
    ),
    TvSensorDescription(
        key="road_condition", translation_key="road_condition", icon="mdi:road-variant",
        group="road",
        value_fn=lambda d: ROAD_CONDITION_TEXT.get(_worst_code(d) or 0) if d.road_conditions else "Inga uppgifter",
    ),
    TvSensorDescription(
        key="road_condition_count", translation_key="road_condition_count", icon="mdi:alert-outline",
        group="road", state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda d: len([r for r in d.road_conditions if (r.code or 1) > 1]),
    ),
    TvSensorDescription(
        key="air_temperature", translation_key="air_temperature", group="weather",
        device_class=SensorDeviceClass.TEMPERATURE, native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        state_class=SensorStateClass.MEASUREMENT, value_fn=_w("air_temperature"),
    ),
    TvSensorDescription(
        key="surface_temperature", translation_key="surface_temperature", group="weather",
        icon="mdi:road", device_class=SensorDeviceClass.TEMPERATURE,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        state_class=SensorStateClass.MEASUREMENT, value_fn=_w("surface_temperature"),
    ),
    TvSensorDescription(
        key="humidity", translation_key="humidity", group="weather",
        device_class=SensorDeviceClass.HUMIDITY, native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT, value_fn=_w("humidity"),
    ),
    TvSensorDescription(
        key="wind_speed", translation_key="wind_speed", group="weather",
        device_class=SensorDeviceClass.WIND_SPEED, native_unit_of_measurement=UnitOfSpeed.METERS_PER_SECOND,
        state_class=SensorStateClass.MEASUREMENT, value_fn=_w("wind_speed"),
    ),
    TvSensorDescription(
        key="wind_direction", translation_key="wind_direction", group="weather",
        icon="mdi:compass-outline", native_unit_of_measurement=DEGREE,
        value_fn=_w("wind_direction"),
    ),
    TvSensorDescription(
        key="precipitation", translation_key="precipitation", group="weather",
        icon="mdi:weather-pouring",
        value_fn=lambda d: PRECIPITATION_TEXT.get(_w("precipitation")(d) or "", _w("precipitation")(d)),
    ),
    TvSensorDescription(
        key="precipitation_30min", translation_key="precipitation_30min", group="weather",
        device_class=SensorDeviceClass.PRECIPITATION,
        native_unit_of_measurement=UnitOfPrecipitationDepth.MILLIMETERS,
        state_class=SensorStateClass.MEASUREMENT, value_fn=_w("precipitation_30min"),
    ),
    TvSensorDescription(
        key="visibility", translation_key="visibility", group="weather", icon="mdi:eye",
        device_class=SensorDeviceClass.DISTANCE, native_unit_of_measurement=UnitOfLength.METERS,
        state_class=SensorStateClass.MEASUREMENT, value_fn=_w("visibility"),
    ),
    TvSensorDescription(
        key="grip", translation_key="grip", group="weather", icon="mdi:car-traction-control",
        state_class=SensorStateClass.MEASUREMENT, value_fn=_w("grip"),
    ),
    TvSensorDescription(
        key="response_size", translation_key="response_size", group="meta",
        entity_category=EntityCategory.DIAGNOSTIC, icon="mdi:download-network",
        device_class=SensorDeviceClass.DATA_SIZE, native_unit_of_measurement=UnitOfInformation.KILOBYTES,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda d: round(d.response_bytes / 1024, 1),
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TrafikverketConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up sensors for the enabled data sets."""
    coordinator = entry.runtime_data
    s = coordinator.settings
    enabled = {"flow": s.flow, "road": s.road, "weather": s.weather, "meta": True}
    entities: list[SensorEntity] = [
        TrafikverketSensor(coordinator, entry, desc) for desc in SENSORS if enabled[desc.group]
    ]
    entities.append(TrafikverketDataUsageSensor(coordinator, entry))
    async_add_entities(entities)


class _Base(CoordinatorEntity[TrafikverketCoordinator], SensorEntity):
    _attr_has_entity_name = True
    _attr_attribution = ATTRIBUTION

    def __init__(self, coordinator: TrafikverketCoordinator, entry: TrafikverketConfigEntry) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            manufacturer="Trafikverket",
            model=NAME,
            entry_type=DeviceEntryType.SERVICE,
            configuration_url="https://api.trafikinfo.trafikverket.se/",
        )


class TrafikverketSensor(_Base):
    """A summary value computed from the latest data."""

    entity_description: TvSensorDescription

    def __init__(self, coordinator, entry, description: TvSensorDescription) -> None:
        super().__init__(coordinator, entry)
        self.entity_description = description
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        # Stable, language independent entity ids (HA adds _2, _3 … for more locations)
        self.entity_id = f"sensor.tv_flow_{description.key}"

    @property
    def native_value(self) -> Any:
        if self.coordinator.data is None:
            return None
        return self.entity_description.value_fn(self.coordinator.data)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        d = self.coordinator.data
        key = self.entity_description.key
        s = self.coordinator.settings
        if key == "flow_sites":
            # The map card reads home position and radius from here.
            return {
                "trafikverket_home": True,
                "config_entry_id": self._entry.entry_id,
                "home_latitude": s.latitude,
                "home_longitude": s.longitude,
                "radius_km": s.radius_km,
                "weather_radius_km": s.weather_radius_km,
                "scan_interval_min": s.scan_interval_min,
                "map_style": s.map_style,
            }
        if self.entity_description.group == "weather" and d and d.nearest_weather:
            w = d.nearest_weather
            return {
                "station": w.name,
                "distance_km": w.distance_km,
                "sample": w.sample.isoformat() if w.sample else None,
            }
        if key == "road_condition" and d:
            return {
                "warnings": sorted({r.warning for r in d.road_conditions if r.warning}),
                "causes": sorted({r.cause for r in d.road_conditions if r.cause}),
            }
        return None


class TrafikverketDataUsageSensor(_Base):
    """Total downloaded data since Home Assistant start (helps tune interval/radius)."""

    _attr_translation_key = "data_usage"
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_icon = "mdi:counter"
    _attr_device_class = SensorDeviceClass.DATA_SIZE
    _attr_native_unit_of_measurement = UnitOfInformation.MEGABYTES
    _attr_state_class = SensorStateClass.TOTAL_INCREASING

    def __init__(self, coordinator, entry) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_data_usage"
        self.entity_id = "sensor.tv_flow_data_usage"

    @property
    def native_value(self) -> float:
        return round(self.coordinator.total_bytes / (1024 * 1024), 3)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"requests": self.coordinator.request_count}
