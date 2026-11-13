"""Place name search (ort → koordinater) via OpenStreetMap Nominatim.

Only used in the setup guide / options, never during normal polling.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import aiohttp

_LOGGER = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "ha-tv-flow (Home Assistant integration; https://github.com/fredrikrudin/ha-tv-flow)"


async def async_search_place(
    session: aiohttp.ClientSession, query: str, limit: int = 8
) -> list[dict[str, Any]]:
    """Return a list of {label, latitude, longitude} for a Swedish place name."""
    params = {
        "q": query,
        "format": "jsonv2",
        "countrycodes": "se",
        "limit": str(limit),
        "accept-language": "sv",
        "addressdetails": "0",
    }
    try:
        async with asyncio.timeout(15):
            async with session.get(
                NOMINATIM_URL, params=params, headers={"User-Agent": USER_AGENT}
            ) as resp:
                if resp.status != 200:
                    _LOGGER.warning("Ortsökning gav HTTP %s", resp.status)
                    return []
                items = await resp.json(content_type=None)
    except (aiohttp.ClientError, TimeoutError, ValueError) as err:
        _LOGGER.warning("Ortsökning misslyckades: %s", err)
        return []

    results: list[dict[str, Any]] = []
    for item in items or []:
        try:
            results.append({
                "label": str(item.get("display_name", "")),
                "latitude": float(item["lat"]),
                "longitude": float(item["lon"]),
            })
        except (KeyError, TypeError, ValueError):
            continue
    return results
