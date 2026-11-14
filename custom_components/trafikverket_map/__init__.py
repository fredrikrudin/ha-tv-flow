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

from .const import CARD_URL, CARD_VERSION, DOMAIN, ROAD_CARD_URL, WARNING_CARD_URL
from .coordinator import TrafikverketCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.GEO_LOCATION, Platform.SENSOR, Platform.WEATHER]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type TrafikverketConfigEntry = ConfigEntry[TrafikverketCoordinator]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the bundled Lovelace map card."""
    www = Path(__file__).parent / "www"
    await hass.http.async_register_static_paths([
        StaticPathConfig(CARD_URL, str(www / "trafikverket-map-card.js"), False),
        StaticPathConfig(ROAD_CARD_URL, str(www / "trafikverket-road-card.js"), False),
        StaticPathConfig(WARNING_CARD_URL, str(www / "trafikverket-warning-card.js"), False),
    ])
    add_extra_js_url(hass, f"{WARNING_CARD_URL}?v={CARD_VERSION}")
    add_extra_js_url(hass, f"{ROAD_CARD_URL}?v={CARD_VERSION}")
    add_extra_js_url(hass, f"{CARD_URL}?v={CARD_VERSION}")
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
    """Reload when options change (radius, interval, …)."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: TrafikverketConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
