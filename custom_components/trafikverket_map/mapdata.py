"""Map points shared by the geo_location entities and the websocket API.

Every flow site, road condition section, weather station and traffic event is
turned into a "map point": name, position, icon and attributes. The same points
are used for

* the optional ``geo_location`` entities (shown on Home Assistant's own map), and
* the ``trafikverket_map/map_data`` websocket command that the bundled cards use,
  so the cards keep working when the entities are turned off.

No Home Assistant imports: this module is unit tested on its own.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
from typing import Any

from .parser import FlowSite, RoadConditionItem, SituationItem, TrafikverketData, WeatherStation
from .texts import ROAD_CONDITION_KEYS, event_type_text, precipitation_text, text

# Values of the "Map points in Home Assistant" setting
MAP_ENTITIES_ICONS = "icons"
MAP_ENTITIES_NAMES = "names"
MAP_ENTITIES_HIDDEN = "hidden"
MAP_ENTITIES_MODES = [MAP_ENTITIES_ICONS, MAP_ENTITIES_NAMES, MAP_ENTITIES_HIDDEN]

SOURCES = {
    "flow": "trafikverket_flow",
    "road": "trafikverket_road",
    "weather": "trafikverket_weather",
    "situation": "trafikverket_situation",
}

SITUATION_ICONS = {
    "Olycka": "mdi:car-emergency",
    "Hinder": "mdi:alert-octagon",
    "Viktig trafikinformation": "mdi:alert-circle",
    "Restriktion": "mdi:sign-caution",
    "Vägarbete": "mdi:account-hard-hat",
    "Färjor": "mdi:ferry",
}
# File names (in www/icons/) used as entity pictures in the "icons" mode
SITUATION_PICTURES = {"Olycka": "event-accident", "Hinder": "event-obstacle", "Vägarbete": "event-roadworks"}


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def speed_class(speed: float | None) -> str:
    """Same speed classes as the map card: fast / medium / slow / crawl / unknown."""
    if speed is None:
        return "unknown"
    if speed >= 70:
        return "fast"
    if speed >= 50:
        return "medium"
    if speed >= 30:
        return "slow"
    return "crawl"


@dataclass
class MapPoint:
    """One point on the map."""

    key: str  # stable id, e.g. "flow_1234"
    kind: str  # flow | road | weather | situation
    name: str
    icon: str
    picture: str  # icon file name without extension (www/icons/<picture>.svg)
    latitude: float
    longitude: float
    distance_km: float
    attributes: dict[str, Any]

    @property
    def source(self) -> str:
        return SOURCES[self.kind]

    def signature(self) -> str:
        """Short hash of everything shown; changes when the point changes."""
        raw = repr((self.name, self.latitude, self.longitude, self.distance_km, sorted(self.attributes.items(), key=str)))
        return hashlib.blake2s(raw.encode(), digest_size=8).hexdigest()


def flow_point(item: FlowSite, lang: str) -> MapPoint:
    speed = item.average_speed
    icon = "mdi:car-off" if speed is None else "mdi:car-multiple" if speed < 30 else "mdi:car-speed-limiter"
    return MapPoint(
        key=f"flow_{item.site_id}", kind="flow",
        name=text(lang, "flow_site", id=item.site_id), icon=icon, picture=f"flow-{speed_class(speed)}",
        latitude=item.latitude, longitude=item.longitude, distance_km=item.distance_km,
        attributes={
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
        },
    )


def road_point(item: RoadConditionItem, lang: str) -> MapPoint:
    road = item.road_number or text(lang, "road_default")
    code = item.code if item.code in ROAD_CONDITION_KEYS else 1
    return MapPoint(
        key=f"road_{item.id}", kind="road",
        name=text(lang, "road", road=road, id=item.id[-6:]),
        icon={1: "mdi:road-variant", 2: "mdi:alert-outline", 3: "mdi:alert", 4: "mdi:snowflake-alert"}.get(item.code or 0, "mdi:road"),
        picture=f"road-{code}",
        latitude=item.latitude, longitude=item.longitude, distance_km=item.distance_km,
        attributes={
            "tv_type": "road",
            "condition_code": item.code,
            "condition_key": ROAD_CONDITION_KEYS.get(item.code or 0),
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
        },
    )


def weather_point(item: WeatherStation, lang: str) -> MapPoint:
    return MapPoint(
        key=f"weather_{item.id}", kind="weather",
        name=text(lang, "weather_station", name=item.name), icon="mdi:weather-partly-cloudy", picture="weather",
        latitude=item.latitude, longitude=item.longitude, distance_km=item.distance_km,
        attributes={
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
            "precipitation_text": precipitation_text(lang, item.precipitation),
            "precipitation_30min": item.precipitation_30min,
            "visibility": item.visibility,
            "grip": item.grip,
            "ice": item.ice,
            "snow": item.snow,
            "water": item.water,
            "sample": _iso(item.sample),
        },
    )


def situation_point(item: SituationItem, lang: str) -> MapPoint:
    return MapPoint(
        key=f"situation_{item.id}", kind="situation",
        name=text(lang, "event", type=event_type_text(lang, item.message_type),
                  road=item.road_number or "", id=item.id[-6:]),
        icon=SITUATION_ICONS.get(item.message_type or "", "mdi:information"),
        picture=SITUATION_PICTURES.get(item.message_type or "", "event-other"),
        latitude=item.latitude, longitude=item.longitude, distance_km=item.distance_km,
        attributes={
            "tv_type": "situation",
            "message_type": item.message_type,
            "message_type_text": event_type_text(lang, item.message_type),
            "message_type_value": item.message_type_value,
            "message_code": item.message_code,
            "is_warning": item.is_warning,
            "header": item.header,
            "message": item.message,
            "severity_code": item.severity_code,
            "severity_text": item.severity_text,
            "road_number": item.road_number,
            "road_name": item.road_name,
            "location_text": item.location,
            "direction": item.direction,
            "temporary_limit": item.temporary_limit,
            "restriction": item.restriction,
            "start_time": _iso(item.start_time),
            "end_time": _iso(item.end_time),
            "until_further_notice": item.until_further_notice,
            "web_link": item.web_link,
            "lines": item.lines,
        },
    )


def map_points(data: TrafikverketData | None, lang: str) -> list[MapPoint]:
    """All map points for one fetch, in a stable order."""
    if data is None:
        return []
    points: list[MapPoint] = []
    points += [flow_point(s, lang) for s in data.flow_sites]
    points += [road_point(r, lang) for r in data.road_conditions]
    points += [situation_point(e, lang) for e in data.situations]
    points += [weather_point(w, lang) for w in data.weather_stations]
    return points


def point_payload(point: MapPoint, entry_id: str, entity_id: str | None) -> dict[str, Any]:
    """A map point in the same shape as a Home Assistant state object (for the cards)."""
    return {
        "entity_id": entity_id or f"trafikverket_map.{point.key}",
        "state": str(point.distance_km),
        "last_updated": point.signature(),
        "attributes": {
            **point.attributes,
            "config_entry_id": entry_id,
            "latitude": point.latitude,
            "longitude": point.longitude,
            "source": point.source,
            "friendly_name": point.name,
        },
    }


def slowest_sites(data: TrafikverketData | None, limit: int = 6) -> list[dict[str, Any]]:
    """Slowest flow sites, for dashboard lists (no geo_location entities needed)."""
    if data is None:
        return []
    sites = sorted((s for s in data.flow_sites if s.average_speed is not None), key=lambda s: s.average_speed)
    return [{"site_id": s.site_id, "average_speed": s.average_speed, "flow": s.total_flow,
             "distance_km": s.distance_km} for s in sites[:limit]]


def difficult_roads(data: TrafikverketData | None, limit: int = 6) -> list[dict[str, Any]]:
    """Road sections with difficult conditions, worst first, for dashboard lists."""
    if data is None:
        return []
    roads = sorted((r for r in data.road_conditions if (r.code or 1) > 1),
                   key=lambda r: (-(r.code or 0), r.distance_km))
    return [{"condition_code": r.code, "road_number": r.road_number, "condition_text": r.text,
             "warning": r.warning, "measure": r.measure, "location_text": r.location_text,
             "distance_km": r.distance_km} for r in roads[:limit]]
