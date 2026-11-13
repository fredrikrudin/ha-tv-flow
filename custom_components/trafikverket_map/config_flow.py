"""Setup guide (config flow) and options for Trafikverket Trafikkarta.

Guide:
  1. user          – API key + name (with instructions for getting a key)
  2. location      – menu: search for a place name, or pick on a map
  3. search / pick – type a place (ort), choose among the hits
  4. map           – fine-tune the position and radius on a map
  5. settings      – update interval, data sets and data limits
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.const import CONF_API_KEY, CONF_LATITUDE, CONF_LOCATION, CONF_LONGITUDE, CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.selector import (
    BooleanSelector,
    LocationSelector,
    LocationSelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TextSelectorConfig,
    TextSelectorType,
)

from .api import TrafikverketAuthError, TrafikverketClient, TrafikverketError
from .const import (
    CONF_ENABLE_FLOW,
    CONF_ENABLE_ROAD,
    CONF_ENABLE_WEATHER,
    CONF_MAP_STYLE,
    CONF_MAX_AGE,
    CONF_MAX_OBJECTS,
    CONF_MINIMAL_FIELDS,
    CONF_RADIUS,
    CONF_SCAN_INTERVAL,
    CONF_WEATHER_RADIUS,
    DEFAULT_MAP_STYLE,
    DEFAULT_MAX_AGE_MIN,
    DEFAULT_MAX_OBJECTS,
    DEFAULT_RADIUS_KM,
    DEFAULT_SCAN_INTERVAL_MIN,
    DEFAULT_WEATHER_RADIUS_KM,
    DOMAIN,
    MAX_RADIUS_KM,
    MAP_STYLES,
    MAX_SCAN_INTERVAL_MIN,
    MIN_RADIUS_KM,
    MIN_SCAN_INTERVAL_MIN,
    NAME,
)
from .geocode import async_search_place

CONF_PLACE = "place"
CONF_CHOICE = "choice"
API_PORTAL = "https://api.trafikinfo.trafikverket.se/"


def _km(min_v: float, max_v: float, step: float = 0.5) -> NumberSelector:
    return NumberSelector(
        NumberSelectorConfig(min=min_v, max=max_v, step=step,
                             unit_of_measurement="km", mode=NumberSelectorMode.BOX)
    )


def _settings_schema(d: Mapping[str, Any]) -> vol.Schema:
    return vol.Schema({
        vol.Required(
            CONF_SCAN_INTERVAL, default=int(d.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL_MIN))
        ): NumberSelector(NumberSelectorConfig(
            min=MIN_SCAN_INTERVAL_MIN, max=MAX_SCAN_INTERVAL_MIN, step=1,
            unit_of_measurement="min", mode=NumberSelectorMode.BOX)),
        vol.Required(CONF_ENABLE_FLOW, default=bool(d.get(CONF_ENABLE_FLOW, True))): BooleanSelector(),
        vol.Required(CONF_ENABLE_ROAD, default=bool(d.get(CONF_ENABLE_ROAD, True))): BooleanSelector(),
        vol.Required(CONF_ENABLE_WEATHER, default=bool(d.get(CONF_ENABLE_WEATHER, True))): BooleanSelector(),
        vol.Required(
            CONF_WEATHER_RADIUS, default=float(d.get(CONF_WEATHER_RADIUS, DEFAULT_WEATHER_RADIUS_KM))
        ): _km(1, 150, 1),
        vol.Required(
            CONF_MAX_OBJECTS, default=int(d.get(CONF_MAX_OBJECTS, DEFAULT_MAX_OBJECTS))
        ): NumberSelector(NumberSelectorConfig(min=10, max=5000, step=10, mode=NumberSelectorMode.BOX)),
        vol.Required(
            CONF_MAX_AGE, default=int(d.get(CONF_MAX_AGE, DEFAULT_MAX_AGE_MIN))
        ): NumberSelector(NumberSelectorConfig(min=5, max=1440, step=5,
                                               unit_of_measurement="min", mode=NumberSelectorMode.BOX)),
        vol.Required(CONF_MINIMAL_FIELDS, default=bool(d.get(CONF_MINIMAL_FIELDS, True))): BooleanSelector(),
        vol.Required(
            CONF_MAP_STYLE, default=str(d.get(CONF_MAP_STYLE, DEFAULT_MAP_STYLE))
        ): SelectSelector(SelectSelectorConfig(
            options=MAP_STYLES, translation_key=CONF_MAP_STYLE, mode=SelectSelectorMode.DROPDOWN)),
    })


def _clean_settings(user_input: Mapping[str, Any]) -> dict[str, Any]:
    data = dict(user_input)
    for key in (CONF_SCAN_INTERVAL, CONF_MAX_OBJECTS, CONF_MAX_AGE):
        data[key] = int(data[key])
    data[CONF_WEATHER_RADIUS] = float(data[CONF_WEATHER_RADIUS])
    return data


async def _validate_key(hass, api_key: str) -> str | None:
    client = TrafikverketClient(async_get_clientsession(hass), api_key)
    try:
        await client.async_validate(hass.config.latitude, hass.config.longitude)
    except TrafikverketAuthError:
        return "invalid_auth"
    except TrafikverketError:
        return "cannot_connect"
    return None


class _LocationSteps:
    """Shared location steps (search → pick → map) for config and options flow."""

    _lat: float
    _lon: float
    _radius_km: float
    _hits: list[dict[str, Any]]
    _place_label: str | None = None

    async def _location_done(self) -> ConfigFlowResult:
        raise NotImplementedError

    async def async_step_search(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            query = user_input[CONF_PLACE].strip()
            hits = await async_search_place(async_get_clientsession(self.hass), query) if query else []
            if not hits:
                errors["base"] = "no_results"
            elif len(hits) == 1:
                return await self._use_hit(hits[0])
            else:
                self._hits = hits
                return await self.async_step_pick()
        return self.async_show_form(
            step_id="search",
            data_schema=vol.Schema({vol.Required(CONF_PLACE): TextSelector()}),
            errors=errors,
        )

    async def async_step_pick(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return await self._use_hit(self._hits[int(user_input[CONF_CHOICE])])
        options = [
            SelectOptionDict(value=str(i), label=h["label"]) for i, h in enumerate(self._hits)
        ]
        return self.async_show_form(
            step_id="pick",
            data_schema=vol.Schema({
                vol.Required(CONF_CHOICE, default="0"): SelectSelector(
                    SelectSelectorConfig(options=options, mode=SelectSelectorMode.LIST)
                )
            }),
        )

    async def _use_hit(self, hit: dict[str, Any]) -> ConfigFlowResult:
        self._lat, self._lon = hit["latitude"], hit["longitude"]
        self._place_label = hit["label"].split(",")[0]
        return await self.async_step_map()

    async def async_step_map(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            loc = user_input.get(CONF_LOCATION) or {}
            self._lat = float(loc.get("latitude", self._lat))
            self._lon = float(loc.get("longitude", self._lon))
            typed = float(user_input[CONF_RADIUS])
            map_km = float(loc.get("radius") or typed * 1000) / 1000
            # Whichever was changed wins: dragging the circle or typing km.
            if abs(typed - self._radius_km) < 0.01 and abs(map_km - typed) > 0.05:
                typed = map_km
            self._radius_km = round(max(MIN_RADIUS_KM, min(MAX_RADIUS_KM, typed)), 2)
            return await self._location_done()

        return self.async_show_form(
            step_id="map",
            data_schema=vol.Schema({
                vol.Required(
                    CONF_LOCATION,
                    default={"latitude": self._lat, "longitude": self._lon,
                             "radius": self._radius_km * 1000},
                ): LocationSelector(LocationSelectorConfig(radius=True, icon="mdi:home-map-marker")),
                vol.Required(CONF_RADIUS, default=self._radius_km): _km(MIN_RADIUS_KM, MAX_RADIUS_KM),
            }),
            description_placeholders={"place": self._place_label or "–"},
        )

    def _location_data(self) -> dict[str, Any]:
        return {
            CONF_LATITUDE: round(self._lat, 6),
            CONF_LONGITUDE: round(self._lon, 6),
            CONF_RADIUS: self._radius_km,
        }


class TrafikverketMapConfigFlow(_LocationSteps, ConfigFlow, domain=DOMAIN):
    """The setup guide."""

    VERSION = 1

    def __init__(self) -> None:
        self._api_key = ""
        self._name = NAME
        self._lat = 0.0
        self._lon = 0.0
        self._radius_km = DEFAULT_RADIUS_KM
        self._hits = []

    # Step 1 – API key
    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        self._lat, self._lon = self.hass.config.latitude, self.hass.config.longitude
        if user_input is not None:
            self._api_key = user_input[CONF_API_KEY].strip()
            self._name = (user_input.get(CONF_NAME) or NAME).strip()
            error = await _validate_key(self.hass, self._api_key)
            if error:
                errors["base"] = error
            else:
                return await self.async_step_location()
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_API_KEY, default=self._api_key): TextSelector(
                    TextSelectorConfig(type=TextSelectorType.PASSWORD)),
                vol.Optional(CONF_NAME, default=self._name): TextSelector(),
            }),
            description_placeholders={"portal": API_PORTAL},
            errors=errors,
        )

    # Step 2 – how to choose the location
    async def async_step_location(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return self.async_show_menu(step_id="location", menu_options=["search", "map"])

    async def _location_done(self) -> ConfigFlowResult:
        await self.async_set_unique_id(f"{self._lat:.3f}_{self._lon:.3f}")
        self._abort_if_unique_id_configured()
        if self._name == NAME and self._place_label:
            self._name = f"Trafik {self._place_label}"
        return await self.async_step_settings()

    # Step 5 – settings / data limits
    async def async_step_settings(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            options = {**self._location_data(), **_clean_settings(user_input)}
            return self.async_create_entry(
                title=self._name, data={CONF_API_KEY: self._api_key}, options=options
            )
        return self.async_show_form(step_id="settings", data_schema=_settings_schema({}))

    # Re-authentication when the key stops working
    async def async_step_reauth(self, entry_data: Mapping[str, Any]) -> ConfigFlowResult:
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            api_key = user_input[CONF_API_KEY].strip()
            error = await _validate_key(self.hass, api_key)
            if error:
                errors["base"] = error
            else:
                return self.async_update_reload_and_abort(
                    self._get_reauth_entry(), data={CONF_API_KEY: api_key}
                )
        return self.async_show_form(
            step_id="reauth_confirm",
            data_schema=vol.Schema({
                vol.Required(CONF_API_KEY): TextSelector(TextSelectorConfig(type=TextSelectorType.PASSWORD))
            }),
            description_placeholders={"portal": API_PORTAL},
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return TrafikverketMapOptionsFlow()


class TrafikverketMapOptionsFlow(_LocationSteps, OptionsFlow):
    """Change place, radius, interval and data sets after setup."""

    def _current(self) -> dict[str, Any]:
        return {**self.config_entry.data, **self.config_entry.options}

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        cur = self._current()
        self._lat = float(cur.get(CONF_LATITUDE, self.hass.config.latitude))
        self._lon = float(cur.get(CONF_LONGITUDE, self.hass.config.longitude))
        self._radius_km = float(cur.get(CONF_RADIUS, DEFAULT_RADIUS_KM))
        self._hits = []
        return self.async_show_menu(step_id="init", menu_options=["search", "map", "settings"])

    async def _location_done(self) -> ConfigFlowResult:
        cur = dict(self.config_entry.options)
        cur.update(self._location_data())
        return self.async_create_entry(data=cur)

    async def async_step_settings(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            cur = dict(self.config_entry.options)
            cur.update(_clean_settings(user_input))
            return self.async_create_entry(data=cur)
        return self.async_show_form(step_id="settings", data_schema=_settings_schema(self._current()))
