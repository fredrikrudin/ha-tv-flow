"""Trafikverket Trafikkarta – traffic flow, road conditions and road weather on a map."""

from __future__ import annotations

from pathlib import Path
import logging

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import CARD_FILES, CARD_VERSION, DOMAIN
from .coordinator import TrafikverketCoordinator
from .dashboard_notify import async_notify_dashboards_later

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.GEO_LOCATION, Platform.SENSOR, Platform.WEATHER]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type TrafikverketConfigEntry = ConfigEntry[TrafikverketCoordinator]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the bundled Lovelace map card."""
    www = Path(__file__).parent / "www"
    await hass.http.async_register_static_paths([
        StaticPathConfig(f"/{DOMAIN}/{name}", str(www / name), False) for name in CARD_FILES
    ])
    for name in CARD_FILES:
        add_extra_js_url(hass, f"/{DOMAIN}/{name}?v={CARD_VERSION}")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: TrafikverketConfigEntry) -> bool:
    """Set up from a config entry."""
    coordinator = TrafikverketCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    return True


async def _async_reload(hass: HomeAssistant, entry: TrafikverketConfigEntry) -> None:
    """Reload when options change (radius, interval, dashboard …)."""
    await hass.config_entries.async_reload(entry.entry_id)
    # Generated dashboards are built when the page loads: tell open ones to refresh.
    hass.async_create_background_task(
        async_notify_dashboards_later(hass), f"{DOMAIN}_notify_dashboards"
    )


async def async_unload_entry(hass: HomeAssistant, entry: TrafikverketConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
