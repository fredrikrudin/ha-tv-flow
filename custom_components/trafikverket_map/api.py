"""Async client for Trafikverket's open API."""

from __future__ import annotations

import asyncio
from datetime import timedelta
import json
import logging
import re
from typing import Any

import aiohttp

from .const import API_URL
from .parser import (
    TrafikverketData,
    TrafikverketResponseError,
    build_request,
    check_errors,
    parse_response,
)

_LOGGER = logging.getLogger(__name__)


class TrafikverketError(Exception):
    """Generic API error."""


class TrafikverketAuthError(TrafikverketError):
    """Invalid API key."""


# Object type -> keyword argument that enables it in async_fetch
_FLAG = {"TrafficFlow": "flow", "RoadCondition": "road", "WeatherObservation": "weather", "Situation": "situation"}

_INVALID_FIELD = re.compile(r"Invalid query attribute\s+([\w.]+)", re.IGNORECASE)


class TrafikverketClient:
    """Small client that fetches flow, road condition and weather in one call."""

    def __init__(self, session: aiohttp.ClientSession, api_key: str) -> None:
        self._session = session
        self._api_key = api_key
        # INCLUDE fields Trafikverket has rejected (for diagnostics) and the
        # object types that are therefore fetched whole, without INCLUDE.
        self.rejected_fields: set[str] = set()
        self.full_objects: set[str] = set()
        # Object types the API rejects even without INCLUDE – skipped so the
        # remaining data sets keep working. objtype -> error message.
        self.disabled_objects: dict[str, str] = {}

    def _learn_rejected(self, message: str) -> bool:
        """React to 'Invalid query attribute X'. True if the next attempt differs."""
        match = _INVALID_FIELD.search(message or "")
        if not match:
            return False
        field = match.group(1)
        objtype = field.split(".", 1)[0]
        self.rejected_fields.add(field)
        if objtype in self.full_objects:
            if objtype in self.disabled_objects or objtype not in _FLAG:
                return False
            self.disabled_objects[objtype] = message
            _LOGGER.error(
                "Trafikverket avvisar %s även utan fältlista (%s). Datamängden stängs av tills "
                "Home Assistant startas om; övriga datamängder fortsätter. Rapportera gärna detta.",
                objtype, message,
            )
            return True
        self.full_objects.add(objtype)
        _LOGGER.warning(
            "Trafikverket godtar inte fältet %s – hämtar %s utan fältlista. "
            "Rapportera gärna detta som ett issue på GitHub.",
            field, objtype,
        )
        return True

    async def _post(self, body: str) -> tuple[dict[str, Any], int]:
        try:
            async with asyncio.timeout(30):
                async with self._session.post(
                    API_URL,
                    data=body.encode("utf-8"),
                    headers={"Content-Type": "text/xml; charset=utf-8"},
                ) as resp:
                    status = resp.status
                    raw = await resp.read()
        except (aiohttp.ClientError, TimeoutError) as err:
            raise TrafikverketError(f"Kunde inte nå Trafikverket: {err}") from err

        try:
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as err:
            if status in (401, 403):
                raise TrafikverketAuthError("Ogiltig API-nyckel") from err
            raise TrafikverketError(f"Ogiltigt svar (HTTP {status})") from err

        if status in (401, 403):
            raise TrafikverketAuthError("Ogiltig API-nyckel")
        if status >= 400:
            try:
                check_errors(payload)
            except TrafikverketResponseError as err:
                if err.auth:
                    raise TrafikverketAuthError(str(err)) from err
                raise TrafikverketError(str(err)) from err
            raise TrafikverketError(f"HTTP {status}")
        return payload, len(raw)

    async def async_fetch(
        self,
        lat: float,
        lon: float,
        radius_km: float,
        weather_radius_km: float,
        *,
        flow: bool,
        road: bool,
        weather: bool,
        limit: int,
        minimal: bool,
        max_age: timedelta,
        situation: bool = False,
    ) -> TrafikverketData:
        """Fetch and parse all enabled data sets."""
        wanted = {"flow": flow, "road": road, "weather": weather, "situation": situation}
        for _attempt in range(10):
            enabled = dict(wanted)
            for objtype in self.disabled_objects:
                enabled[_FLAG[objtype]] = False
            if not any(enabled.values()):
                data = TrafikverketData()
            else:
                data = await self._fetch_once(
                    lat, lon, radius_km, weather_radius_km, limit=limit, minimal=minimal,
                    max_age=max_age, **enabled,
                )
            if data is not None:
                for objtype, msg in self.disabled_objects.items():
                    if wanted[_FLAG[objtype]]:
                        data.errors[objtype] = f"Avstängd: {msg}"
                if not any(enabled.values()) and self.disabled_objects:
                    raise TrafikverketError(
                        "Trafikverket avvisar alla valda datamängder: "
                        + "; ".join(f"{k}: {v}" for k, v in self.disabled_objects.items())
                    )
                return data
        raise TrafikverketError(
            f"Trafikverket avvisar frågan även utan fältlista (avvisade fält: {sorted(self.rejected_fields)})"
        )

    async def _fetch_once(
        self, lat, lon, radius_km, weather_radius_km, *, flow, road, weather,
        limit, minimal, max_age, situation,
    ) -> TrafikverketData | None:
        """One request. None means: a field was rejected, try again without it."""
        body, order = build_request(
            self._api_key,
            lat,
            lon,
            int(radius_km * 1000),
            int(weather_radius_km * 1000),
            flow=flow,
            road=road,
            weather=weather,
            limit=limit,
            minimal=minimal,
            max_age_min=int(max_age.total_seconds() // 60),
            situation=situation,
            exclude=frozenset(self.rejected_fields | self.full_objects),
        )
        _LOGGER.debug("Trafikverket request: %s", body.replace(self._api_key, "***"))
        try:
            payload, size = await self._post(body)
        except TrafikverketAuthError:
            raise
        except TrafikverketError as err:
            if minimal and self._learn_rejected(str(err)):
                return None
            raise
        try:
            data = parse_response(
                payload, order, (lat, lon), radius_km, weather_radius_km, max_age
            )
        except TrafikverketResponseError as err:
            if err.auth:
                raise TrafikverketAuthError(str(err)) from err
            if minimal and self._learn_rejected(str(err)):
                return None
            raise TrafikverketError(str(err)) from err
        if minimal and any(self._learn_rejected(msg) for msg in list(data.errors.values())):
            return None
        data.response_bytes = size
        for objtype, msg in data.errors.items():
            _LOGGER.warning("Trafikverket gav fel för %s: %s", objtype, msg)
        _LOGGER.debug(
            "Trafikverket: %s bytes, raw=%s, flow=%d road=%d weather=%d situations=%d",
            size,
            data.raw_counts,
            len(data.flow_sites),
            len(data.road_conditions),
            len(data.weather_stations),
            len(data.situations),
        )
        return data

    async def async_validate(self, lat: float, lon: float) -> None:
        """Make a very small request to validate the key."""
        await self.async_fetch(
            lat, lon, 1.0, 1.0,
            flow=False, road=True, weather=False,
            limit=1, minimal=True, max_age=timedelta(hours=1),
        )
