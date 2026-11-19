"""Tell open dashboards that the generated (custom:tv-flow) dashboard has changed.

Home Assistant builds a strategy dashboard once, when the page loads. After the
user changes order, sections or map height in the options, open dashboards keep
the old layout. Firing ``lovelace_updated`` for the dashboards that use our
strategy makes the frontend offer a refresh (the same event Home Assistant fires
when a dashboard is edited).

Only standard objects are used and everything is best effort: if Home Assistant's
internal Lovelace structures change, nothing breaks – the user can still reload
the page.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

_LOGGER = logging.getLogger(__name__)

EVENT_LOVELACE_UPDATED = "lovelace_updated"
STRATEGY_TYPE = "custom:tv-flow"
# Wait for the reloaded entities, incl. the sibling entity-id refresh after 5 s.
NOTIFY_DELAY_S = 6


def _dashboards(hass: Any) -> dict:
    """Return {url_path: dashboard} from Home Assistant's Lovelace data."""
    data = getattr(hass, "data", {}).get("lovelace")
    if data is None:
        return {}
    dashboards = getattr(data, "dashboards", None)
    if dashboards is None and isinstance(data, dict):
        dashboards = data.get("dashboards")
    return dashboards or {}


async def async_find_strategy_dashboards(hass: Any) -> list[str | None]:
    """url_paths of dashboards whose config uses the custom:tv-flow strategy."""
    found: list[str | None] = []
    for url_path, dashboard in list(_dashboards(hass).items()):
        try:
            config = await dashboard.async_load(False)
        except Exception:  # noqa: BLE001 - no stored config, YAML errors etc.
            continue
        strategy = (config or {}).get("strategy") if isinstance(config, dict) else None
        if isinstance(strategy, dict) and strategy.get("type") == STRATEGY_TYPE:
            found.append(url_path)
    return found


async def async_notify_dashboards(hass: Any) -> list[str | None]:
    """Fire lovelace_updated for every dashboard using our strategy."""
    try:
        targets = await async_find_strategy_dashboards(hass)
    except Exception as err:  # noqa: BLE001 - never break the integration for this
        _LOGGER.debug("Could not look up dashboards: %s", err)
        return []
    for url_path in targets:
        hass.bus.async_fire(EVENT_LOVELACE_UPDATED, {"url_path": url_path})
    if targets:
        _LOGGER.debug("Asked dashboards %s to refresh after a settings change", targets)
    return targets


async def async_notify_dashboards_later(hass: Any, delay: float = NOTIFY_DELAY_S) -> None:
    """Wait until the reloaded entities have their new attributes, then notify."""
    await asyncio.sleep(delay)
    await async_notify_dashboards(hass)
