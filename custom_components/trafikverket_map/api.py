"""Async client for Trafikverket's open API."""

from __future__ import annotations

import asyncio
from datetime import timedelta
import json
import logging
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


class TrafikverketClient:
    """Small client that fetches flow, road condition and weather in one call."""

    def __init__(self, session: aiohttp.ClientSession, api_key: str) -> None:
        self._session = session
        self._api_key = api_key

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
        if not (flow or road or weather or situation):
            return TrafikverketData()
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
        )
        _LOGGER.debug("Trafikverket request: %s", body.replace(self._api_key, "***"))
        payload, size = await self._post(body)
        try:
            data = parse_response(
                payload, order, (lat, lon), radius_km, weather_radius_km, max_age
            )
        except TrafikverketResponseError as err:
            if err.auth:
                raise TrafikverketAuthError(str(err)) from err
            raise TrafikverketError(str(err)) from err
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
