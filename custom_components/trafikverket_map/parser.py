"""Pure helpers for building requests to and parsing responses from Trafikverket.

This module has no Home Assistant or aiohttp dependencies so it can be unit
tested on its own.

Object types and schema versions (from Trafikverket's XSD files):
  * TrafficFlow         namespace road.trafficinfo  schema 1.5
  * RoadCondition       namespace road.trafficinfo  schema 1.3
  * WeatherObservation  namespace road.weatherinfo  schema 2.1
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import math
import re
from typing import Any
from xml.sax.saxutils import quoteattr

FLOW_OBJECT = ("TrafficFlow", "road.trafficinfo", "1.5")
ROAD_OBJECT = ("RoadCondition", "road.trafficinfo", "1.3")
WEATHER_OBJECT = ("WeatherObservation", "road.weatherinfo", "2.1")
SITUATION_OBJECT = ("Situation", "road.trafficinfo", "1.5")

FLOW_FIELDS = [
    "SiteId",
    "MeasurementTime",
    "MeasurementOrCalculationPeriod",
    "VehicleType",
    "VehicleFlowRate",
    "AverageVehicleSpeed",
    "SpecificLane",
    "MeasurementSide",
    "DataQuality",
    "Geometry.WGS84",
]

ROAD_FIELDS = [
    "Id",
    "Cause",
    "ConditionCode",
    "ConditionInfo",
    "ConditionText",
    "Measure",
    "Warning",
    "LocationText",
    "RoadNumber",
    "StartTime",
    "EndTime",
    "SafetyRelatedMessage",
    "Geometry.WGS84",
]

WEATHER_FIELDS = [
    "Id",
    "Sample",
    "Measurepoint.Id",
    "Measurepoint.Name",
    "Measurepoint.Geometry.WGS84",
    "Weather.Precipitation",
    "Air.Temperature.Value",
    "Air.Dewpoint.Value",
    "Air.RelativeHumidity.Value",
    "Air.VisibleDistance.Value",
    "Surface.Temperature.Value",
    "Surface.Grip.Value",
    "Surface.Ice",
    "Surface.Snow",
    "Surface.Water",
    "Wind.Height",
    "Wind.Speed.Value",
    "Wind.Direction.Value",
    "Aggregated10minutes.Wind.SpeedMax.Value",
    "Aggregated30minutes.Precipitation.TotalWaterEquivalent.Value",
    "Aggregated30minutes.Precipitation.Rain",
    "Aggregated30minutes.Precipitation.Snow",
]

SITUATION_FIELDS = [
    "Id",
    "Deviation.MessageType",
    "Deviation.MessageTypeValue",
    "Deviation.MessageCode",
    "Deviation.Header",
    "Deviation.Message",
    "Deviation.SeverityCode",
    "Deviation.SeverityText",
    "Deviation.RoadNumber",
    "Deviation.RoadName",
    "Deviation.LocationDescriptor",
    "Deviation.PositionalDescription",
    "Deviation.AffectedDirection",
    "Deviation.TemporaryLimit",
    "Deviation.TrafficRestrictionType",
    "Deviation.StartTime",
    "Deviation.EndTime",
    "Deviation.ValidUntilFurtherNotice",
    "Deviation.WebLink",
    "Deviation.Geometry.Point.WGS84",
    "Deviation.Geometry.Line.WGS84",
]

# Message types that count as a warning (road works and ferries are routine).
WARNING_TYPES = ("Olycka", "Hinder", "Viktig trafikinformation", "Restriktion", "Trafikmeddelande")
TYPE_RANK = {"Olycka": 5, "Hinder": 4, "Viktig trafikinformation": 3, "Restriktion": 2,
             "Trafikmeddelande": 1, "Vägarbete": 0, "Färjor": 0}

ROAD_CONDITION_TEXT = {
    1: "Normalt",
    2: "Besvärligt (risk för)",
    3: "Mycket besvärligt",
    4: "Is- och snövägbana",
}

PRECIPITATION_TEXT = {
    "no": "Ingen nederbörd",
    "rain": "Regn",
    "freezing_rain": "Underkylt regn",
    "snow": "Snö",
    "sleet": "Snöblandat regn",
    "yes": "Nederbörd",
}


# --------------------------------------------------------------------------
# Data classes
# --------------------------------------------------------------------------


@dataclass
class FlowSite:
    """A traffic flow measurement site (aggregated over lanes/vehicle types)."""

    site_id: int
    latitude: float
    longitude: float
    distance_km: float
    measurement_time: datetime | None
    total_flow: int  # vehicles / hour
    average_speed: float | None  # km/h, flow weighted
    min_speed: float | None
    data_quality: str | None
    period_s: int | None
    lanes: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class RoadConditionItem:
    """A road condition (väglag) segment."""

    id: str
    latitude: float
    longitude: float
    distance_km: float
    code: int | None
    text: str | None
    info: str | None
    cause: str | None
    warning: str | None
    measure: str | None
    location_text: str | None
    road_number: str | None
    start_time: datetime | None
    end_time: datetime | None
    lines: list[list[list[float]]] = field(default_factory=list)  # [[ [lat,lon], ...], ...]


@dataclass
class WeatherStation:
    """A road weather station observation."""

    id: str
    station_id: int | None
    name: str
    latitude: float
    longitude: float
    distance_km: float
    sample: datetime | None
    precipitation: str | None
    air_temperature: float | None
    dewpoint: float | None
    humidity: float | None
    visibility: float | None
    surface_temperature: float | None
    grip: float | None
    ice: bool | None
    snow: bool | None
    water: bool | None
    wind_speed: float | None
    wind_direction: int | None
    wind_gust: float | None
    precipitation_30min: float | None


@dataclass
class SituationItem:
    """One deviation (händelse) from a Situation."""

    id: str
    situation_id: str | None
    message_type: str | None
    message_type_value: str | None
    message_code: str | None
    header: str | None
    message: str | None
    severity_code: int | None
    severity_text: str | None
    road_number: str | None
    road_name: str | None
    location: str | None
    direction: str | None
    temporary_limit: str | None
    restriction: str | None
    start_time: datetime | None
    end_time: datetime | None
    until_further_notice: bool | None
    web_link: str | None
    latitude: float
    longitude: float
    distance_km: float
    lines: list[list[list[float]]] = field(default_factory=list)

    @property
    def is_warning(self) -> bool:
        return (self.message_type or "") in WARNING_TYPES

    @property
    def rank(self) -> tuple[int, int]:
        return (TYPE_RANK.get(self.message_type or "", 1), self.severity_code or 0)


@dataclass
class TrafikverketData:
    """Everything fetched in one update."""

    flow_sites: list[FlowSite] = field(default_factory=list)
    road_conditions: list[RoadConditionItem] = field(default_factory=list)
    weather_stations: list[WeatherStation] = field(default_factory=list)
    situations: list[SituationItem] = field(default_factory=list)
    fetched_at: datetime | None = None
    response_bytes: int = 0
    raw_counts: dict[str, int] = field(default_factory=dict)
    errors: dict[str, str] = field(default_factory=dict)

    @property
    def warnings(self) -> list[SituationItem]:
        """Active warning-type events, most serious first."""
        return sorted((s for s in self.situations if s.is_warning),
                      key=lambda s: (s.rank, -s.distance_km), reverse=True)

    @property
    def active_warning_count(self) -> int:
        """Warning events + road sections with difficult conditions."""
        return len(self.warnings) + len([r for r in self.road_conditions if (r.code or 1) > 1])

    @property
    def nearest_weather(self) -> WeatherStation | None:
        """Return the closest weather station that has an air temperature."""
        with_temp = [w for w in self.weather_stations if w.air_temperature is not None]
        pool = with_temp or self.weather_stations
        return min(pool, key=lambda w: w.distance_km) if pool else None


# --------------------------------------------------------------------------
# Request building
# --------------------------------------------------------------------------


def _query(
    obj: tuple[str, str, str],
    geometry_field: str,
    lat: float,
    lon: float,
    radius_m: int,
    limit: int,
    fields: list[str] | None,
    extra_filter: str = "",
    orderby: str | None = None,
    exclude: set[str] | frozenset[str] = frozenset(),
) -> str:
    objecttype, namespace, schema = obj
    if fields:
        fields = [f for f in fields if f"{objecttype}.{f}" not in exclude and f not in exclude]
    include = "".join(f"<INCLUDE>{f}</INCLUDE>" for f in fields) if fields else ""
    order = f' orderby="{orderby}"' if orderby else ""
    return (
        f'<QUERY objecttype="{objecttype}" namespace="{namespace}" '
        f'schemaversion="{schema}" limit="{int(limit)}"{order}>'
        "<FILTER><AND>"
        f'<WITHIN name="{geometry_field}" shape="center" '
        f'value="{lon:.6f} {lat:.6f}" radius="{int(radius_m)}m" />'
        f"{extra_filter}"
        "</AND></FILTER>"
        f"{include}"
        "</QUERY>"
    )


def timespan(minutes: int) -> str:
    """Format minutes as Trafikverket's [d.]hh:mm:ss timespan."""
    minutes = max(1, int(minutes))
    days, rest = divmod(minutes, 1440)
    hours, mins = divmod(rest, 60)
    core = f"{hours:02d}:{mins:02d}:00"
    return f"{days}.{core}" if days else core


# WeatherObservation holds every observation from the last seven days (one
# every 5–10 minutes per station), so only ask for the most recent ones.
WEATHER_WINDOW_MAX_MIN = 60
WEATHER_LIMIT_MIN = 200


def build_request(
    api_key: str,
    lat: float,
    lon: float,
    radius_m: int,
    weather_radius_m: int,
    *,
    flow: bool,
    road: bool,
    weather: bool,
    limit: int,
    minimal: bool,
    max_age_min: int = 60,
    situation: bool = False,
    exclude: set[str] | frozenset[str] = frozenset(),
) -> tuple[str, list[str]]:
    """Build one XML request with one QUERY per enabled object type.

    Returns the XML body and the order of object types (RESULT is returned in
    the same order as the QUERY elements).
    """
    queries: list[str] = []
    order: list[str] = []
    if flow:
        queries.append(
            _query(FLOW_OBJECT, "Geometry.WGS84", lat, lon, radius_m, limit,
                   FLOW_FIELDS if minimal else None, exclude=exclude)
        )
        order.append("TrafficFlow")
    if road:
        queries.append(
            _query(ROAD_OBJECT, "Geometry.WGS84", lat, lon, radius_m, limit,
                   ROAD_FIELDS if minimal else None,
                   '<EQ name="Deleted" value="false" />', exclude=exclude)
        )
        order.append("RoadCondition")
    if weather:
        window = min(max(int(max_age_min), 15), WEATHER_WINDOW_MAX_MIN)
        queries.append(
            _query(WEATHER_OBJECT, "Measurepoint.Geometry.WGS84", lat, lon,
                   weather_radius_m, max(WEATHER_LIMIT_MIN, limit),
                   WEATHER_FIELDS if minimal else None,
                   '<EQ name="Deleted" value="false" />'
                   f'<GT name="Sample" value="$dateadd(-{timespan(window)})" />',
                   orderby="Sample desc", exclude=exclude)
        )
        order.append("WeatherObservation")
    if situation:
        queries.append(
            _query(SITUATION_OBJECT, "Deviation.Geometry.Point.WGS84", lat, lon, radius_m, limit,
                   SITUATION_FIELDS if minimal else None,
                   '<EQ name="Deleted" value="false" />', exclude=exclude)
        )
        order.append("Situation")

    body = (
        "<REQUEST>"
        f"<LOGIN authenticationkey={quoteattr(api_key)} />"
        + "".join(queries)
        + "</REQUEST>"
    )
    return body, order


# --------------------------------------------------------------------------
# Geometry helpers
# --------------------------------------------------------------------------

_NUM = r"-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?"
_PAIR_RE = re.compile(rf"({_NUM})\s+({_NUM})(?:\s+{_NUM})*")


def parse_wkt(wkt: str | None) -> list[list[list[float]]]:
    """Parse a WGS84 WKT string into a list of parts of [lat, lon] points.

    POINT -> [[[lat, lon]]], LINESTRING -> [[...]], MULTILINESTRING -> [[...], [...]].
    Polygons are handled like line strings (outer + inner rings).
    """
    if not wkt:
        return []
    start = wkt.find("(")
    if start < 0:
        return []
    inner = wkt[start:]
    # Split into groups at the innermost parentheses
    groups = re.findall(r"\(([^()]*)\)", inner)
    parts: list[list[list[float]]] = []
    for group in groups:
        points: list[list[float]] = []
        for chunk in group.split(","):
            m = _PAIR_RE.search(chunk.strip())
            if not m:
                continue
            lon, lat = float(m.group(1)), float(m.group(2))
            points.append([round(lat, 6), round(lon, 6)])
        if points:
            parts.append(points)
    return parts


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great circle distance in km."""
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def parse_time(value: str | None) -> datetime | None:
    """Parse an ISO timestamp from the API."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _value(obj: Any, *path: str) -> Any:
    """Safely walk nested dicts. Lists pick the first element."""
    cur = obj
    for key in path:
        if isinstance(cur, list):
            cur = cur[0] if cur else None
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def _float(v: Any) -> float | None:
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None


def _int(v: Any) -> int | None:
    try:
        return None if v is None else int(v)
    except (TypeError, ValueError):
        return None


def _bool(v: Any) -> bool | None:
    if isinstance(v, bool):
        return v
    if isinstance(v, dict):  # tolerate {"Value": true}
        v = v.get("Value")
    if isinstance(v, str):
        return v.lower() == "true"
    return None if v is None else bool(v)


# --------------------------------------------------------------------------
# Response parsing
# --------------------------------------------------------------------------


class TrafikverketResponseError(Exception):
    """The API returned an ERROR element."""

    def __init__(self, message: str, auth: bool = False) -> None:
        super().__init__(message)
        self.auth = auth


def _error_of(res: Any) -> TrafikverketResponseError | None:
    err = res.get("ERROR") if isinstance(res, dict) else None
    if not err:
        return None
    msg = f"{err.get('SOURCE', '')}: {err.get('MESSAGE', '')}".strip(": ")
    low = msg.lower()
    auth = "authenticat" in low or "login" in low or "invalid key" in low
    return TrafikverketResponseError(msg or "Okänt fel", auth=auth)


def check_errors(payload: dict[str, Any]) -> None:
    """Raise if any result is an ERROR (used for non-200 responses)."""
    results = payload.get("RESPONSE", {}).get("RESULT", []) or []
    for res in results:
        err = _error_of(res)
        if err:
            raise err
    if not results and payload.get("RESPONSE", {}).get("ERROR"):
        raise _error_of(payload["RESPONSE"]) or TrafikverketResponseError("Okänt fel")


def parse_flow(
    records: list[dict[str, Any]], home: tuple[float, float], radius_km: float,
    max_age: timedelta, now: datetime,
) -> list[FlowSite]:
    """Aggregate raw TrafficFlow records per SiteId."""
    by_site: dict[int, list[dict[str, Any]]] = {}
    geo: dict[int, tuple[float, float]] = {}
    for rec in records:
        if rec.get("Deleted"):
            continue
        site = _int(rec.get("SiteId"))
        if site is None:
            continue
        mtime = parse_time(rec.get("MeasurementTime"))
        if mtime and now - mtime > max_age:
            continue
        parts = parse_wkt(_value(rec, "Geometry", "WGS84"))
        if parts:
            geo.setdefault(site, (parts[0][0][0], parts[0][0][1]))
        by_site.setdefault(site, []).append(rec)

    sites: list[FlowSite] = []
    for site_id, recs in by_site.items():
        if site_id not in geo:
            continue
        lat, lon = geo[site_id]
        dist = haversine_km(home[0], home[1], lat, lon)
        if dist > radius_km * 1.05:
            continue

        # Avoid double counting if both "anyVehicle" and specific types exist.
        any_recs = [r for r in recs if r.get("VehicleType") == "anyVehicle"]
        counted = {id(r) for r in (any_recs or recs)}

        total_flow = 0
        w_speed = 0.0
        w_sum = 0
        speeds: list[float] = []
        lanes: list[dict[str, Any]] = []
        times: list[datetime] = []
        qualities: set[str] = set()
        period = None
        for r in recs:
            flow = _int(r.get("VehicleFlowRate")) or 0
            speed = _float(r.get("AverageVehicleSpeed"))
            t = parse_time(r.get("MeasurementTime"))
            if t:
                times.append(t)
            if r.get("DataQuality"):
                qualities.add(str(r["DataQuality"]))
            period = period or _int(r.get("MeasurementOrCalculationPeriod"))
            lanes.append({
                "lane": r.get("SpecificLane"),
                "side": r.get("MeasurementSide"),
                "vehicle_type": r.get("VehicleType"),
                "flow": flow,
                "speed": round(speed, 1) if speed is not None else None,
            })
            if id(r) in counted:
                total_flow += flow
                if speed is not None and speed > 0:
                    speeds.append(speed)
                    weight = max(flow, 1)
                    w_speed += speed * weight
                    w_sum += weight

        quality = None
        for q in ("bad", "degraded", "good"):
            if q in qualities:
                quality = q
                break

        sites.append(FlowSite(
            site_id=site_id,
            latitude=lat,
            longitude=lon,
            distance_km=round(dist, 2),
            measurement_time=max(times) if times else None,
            total_flow=total_flow,
            average_speed=round(w_speed / w_sum, 1) if w_sum else None,
            min_speed=round(min(speeds), 1) if speeds else None,
            data_quality=quality,
            period_s=period,
            lanes=sorted(lanes, key=lambda x: (str(x["side"]), str(x["lane"]), str(x["vehicle_type"]))),
        ))
    sites.sort(key=lambda s: s.distance_km)
    return sites


def parse_road(
    records: list[dict[str, Any]], home: tuple[float, float], radius_km: float,
    now: datetime,
) -> list[RoadConditionItem]:
    """Parse RoadCondition records."""
    items: list[RoadConditionItem] = []
    for rec in records:
        if rec.get("Deleted"):
            continue
        end = parse_time(rec.get("EndTime"))
        if end and end < now:
            continue
        parts = parse_wkt(_value(rec, "Geometry", "WGS84"))
        if not parts:
            continue
        all_pts = [p for part in parts for p in part]
        nearest = min(all_pts, key=lambda p: haversine_km(home[0], home[1], p[0], p[1]))
        dist = haversine_km(home[0], home[1], nearest[0], nearest[1])
        if dist > radius_km * 1.05:
            continue
        first = parts[0]
        mid = first[len(first) // 2]
        code = _int(rec.get("ConditionCode"))
        items.append(RoadConditionItem(
            id=str(rec.get("Id") or f"{mid[0]},{mid[1]}"),
            latitude=mid[0],
            longitude=mid[1],
            distance_km=round(dist, 2),
            code=code,
            text=rec.get("ConditionText") or ROAD_CONDITION_TEXT.get(code or 0),
            info=rec.get("ConditionInfo"),
            cause=rec.get("Cause"),
            warning=rec.get("Warning"),
            measure=rec.get("Measure"),
            location_text=rec.get("LocationText"),
            road_number=rec.get("RoadNumber"),
            start_time=parse_time(rec.get("StartTime")),
            end_time=end,
            lines=parts,
        ))
    items.sort(key=lambda i: i.distance_km)
    return items


def _pick_wind(winds: Any) -> dict[str, Any] | None:
    if isinstance(winds, dict):
        return winds
    if not isinstance(winds, list) or not winds:
        return None
    for w in winds:
        if isinstance(w, dict) and str(w.get("Height")) == "10":
            return w
    return winds[0] if isinstance(winds[0], dict) else None


def parse_weather(
    records: list[dict[str, Any]], home: tuple[float, float], radius_km: float,
    max_age: timedelta, now: datetime,
) -> list[WeatherStation]:
    """Parse WeatherObservation records, keeping the latest sample per station."""
    latest: dict[str, WeatherStation] = {}
    for rec in records:
        if rec.get("Deleted"):
            continue
        mp = rec.get("Measurepoint") or {}
        parts = parse_wkt(_value(mp, "Geometry", "WGS84"))
        if not parts:
            continue
        lat, lon = parts[0][0]
        dist = haversine_km(home[0], home[1], lat, lon)
        if dist > radius_km * 1.05:
            continue
        sample = parse_time(rec.get("Sample"))
        if sample and now - sample > max_age:
            continue
        wind = _pick_wind(rec.get("Wind"))
        # Station key: measurepoint id, else name + position. Never the
        # observation Id – that is unique per sample, not per station.
        if mp.get("Id") is not None:
            key = f"id:{mp['Id']}"
        else:
            key = f"{mp.get('Name') or ''}@{lat:.5f},{lon:.5f}"
        station = WeatherStation(
            id=key,
            station_id=_int(mp.get("Id")),
            name=str(mp.get("Name") or f"Väderstation {key}"),
            latitude=lat,
            longitude=lon,
            distance_km=round(dist, 2),
            sample=sample,
            precipitation=_value(rec, "Weather", "Precipitation"),
            air_temperature=_float(_value(rec, "Air", "Temperature", "Value")),
            dewpoint=_float(_value(rec, "Air", "Dewpoint", "Value")),
            humidity=_float(_value(rec, "Air", "RelativeHumidity", "Value")),
            visibility=_float(_value(rec, "Air", "VisibleDistance", "Value")),
            surface_temperature=_float(_value(rec, "Surface", "Temperature", "Value")),
            grip=_float(_value(rec, "Surface", "Grip", "Value")),
            ice=_bool(_value(rec, "Surface", "Ice")),
            snow=_bool(_value(rec, "Surface", "Snow")),
            water=_bool(_value(rec, "Surface", "Water")),
            wind_speed=_float(_value(wind, "Speed", "Value")) if wind else None,
            wind_direction=_int(_value(wind, "Direction", "Value")) if wind else None,
            wind_gust=_float(_value(rec, "Aggregated10minutes", "Wind", "SpeedMax", "Value")),
            precipitation_30min=_float(
                _value(rec, "Aggregated30minutes", "Precipitation", "TotalWaterEquivalent", "Value")
            ),
        )
        prev = latest.get(key)
        if prev is None or (sample and (prev.sample is None or sample > prev.sample)):
            latest[key] = station
    stations = sorted(latest.values(), key=lambda s: s.distance_km)
    return stations


def parse_situations(
    records: list[dict[str, Any]], home: tuple[float, float], radius_km: float, now: datetime,
) -> list[SituationItem]:
    """Flatten Situation → Deviation and keep active ones inside the radius."""
    items: list[SituationItem] = []
    seen: set[str] = set()
    for sit in records:
        if sit.get("Deleted"):
            continue
        devs = sit.get("Deviation") or []
        if isinstance(devs, dict):
            devs = [devs]
        for idx, dev in enumerate(devs):
            if not isinstance(dev, dict):
                continue
            start = parse_time(dev.get("StartTime"))
            end = parse_time(dev.get("EndTime"))
            if end and end < now and not dev.get("ValidUntilFurtherNotice"):
                continue
            if start and start > now:
                continue  # planned, not started yet
            point = parse_wkt(_value(dev, "Geometry", "Point", "WGS84"))
            lines = parse_wkt(_value(dev, "Geometry", "Line", "WGS84"))
            pts = [p for part in (lines or point) for p in part]
            if not pts:
                continue
            nearest = min(pts, key=lambda p: haversine_km(home[0], home[1], p[0], p[1]))
            dist = haversine_km(home[0], home[1], nearest[0], nearest[1])
            if dist > radius_km * 1.05:
                continue
            lat, lon = point[0][0] if point else lines[0][len(lines[0]) // 2]
            dev_id = str(dev.get("Id") or f"{sit.get('Id', 'sit')}:{dev.get('MessageCode') or dev.get('MessageType') or ''}:{idx}")
            if dev_id in seen:
                continue
            seen.add(dev_id)
            items.append(SituationItem(
                id=dev_id,
                situation_id=sit.get("Id"),
                message_type=dev.get("MessageType"),
                message_type_value=dev.get("MessageTypeValue"),
                message_code=dev.get("MessageCode"),
                header=dev.get("Header"),
                message=dev.get("Message"),
                severity_code=_int(dev.get("SeverityCode")),
                severity_text=dev.get("SeverityText"),
                road_number=dev.get("RoadNumber"),
                road_name=dev.get("RoadName"),
                location=dev.get("LocationDescriptor") or dev.get("PositionalDescription"),
                direction=dev.get("AffectedDirection"),
                temporary_limit=dev.get("TemporaryLimit"),
                restriction=dev.get("TrafficRestrictionType"),
                start_time=start,
                end_time=end,
                until_further_notice=_bool(dev.get("ValidUntilFurtherNotice")),
                web_link=dev.get("WebLink"),
                latitude=lat,
                longitude=lon,
                distance_km=round(dist, 2),
                lines=lines,
            ))
    items.sort(key=lambda i: (i.rank, -i.distance_km), reverse=True)
    return items


def parse_response(
    payload: dict[str, Any],
    order: list[str],
    home: tuple[float, float],
    radius_km: float,
    weather_radius_km: float,
    max_age: timedelta,
    now: datetime | None = None,
) -> TrafikverketData:
    """Parse a complete multi-query response."""
    now = now or datetime.now(timezone.utc)
    results = payload.get("RESPONSE", {}).get("RESULT", []) or []
    data = TrafikverketData(fetched_at=now)
    failed: list[TrafikverketResponseError] = []
    for idx, objtype in enumerate(order):
        res = results[idx] if idx < len(results) else {}
        err = _error_of(res)
        if err:
            # One failing data set (e.g. weather) must not hide the others.
            failed.append(err)
            data.errors[objtype] = str(err)
            continue
        records = res.get(objtype, []) if isinstance(res, dict) else []
        data.raw_counts[objtype] = len(records)
        if objtype == "TrafficFlow":
            data.flow_sites = parse_flow(records, home, radius_km, max_age, now)
        elif objtype == "RoadCondition":
            data.road_conditions = parse_road(records, home, radius_km, now)
        elif objtype == "WeatherObservation":
            data.weather_stations = parse_weather(records, home, weather_radius_km, max_age, now)
        elif objtype == "Situation":
            data.situations = parse_situations(records, home, radius_km, now)
    if failed and len(failed) == len(order):
        auth = next((e for e in failed if e.auth), None)
        raise auth or failed[0]
    return data
