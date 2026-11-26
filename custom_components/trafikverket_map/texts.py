"""Localized texts used by the integration (Swedish and English).

Entity names, sensor states and config flow texts are translated through
Home Assistant's translation files. This module covers the few texts the
integration builds itself: names of the dynamic geo_location entities and
human readable attribute values.

Values that come from Trafikverket (road names, warnings, event messages)
are Swedish in the source data and are passed through unchanged.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # keeps this module importable without Home Assistant (tests)
    from homeassistant.core import HomeAssistant

# Language independent keys
ROAD_CONDITION_KEYS = {1: "normal", 2: "difficult", 3: "very_difficult", 4: "ice_snow"}
ROAD_CONDITION_NO_DATA = "no_data"
PRECIPITATION_KEYS = ["no", "rain", "freezing_rain", "snow", "sleet", "yes"]

TEXTS: dict[str, dict] = {
    "sv": {
        "flow_site": "Trafikflöde {id}",
        "road": "Väglag {road} {id}",
        "road_default": "Väg",
        "weather_station": "Väderstation {name}",
        "event": "{type} {road} {id}",
        "event_default": "Händelse",
        "road_condition": {
            "normal": "Normalt",
            "difficult": "Besvärligt (risk för)",
            "very_difficult": "Mycket besvärligt",
            "ice_snow": "Is- och snövägbana",
            "no_data": "Inga uppgifter",
        },
        "precipitation": {
            "no": "Ingen nederbörd",
            "rain": "Regn",
            "freezing_rain": "Underkylt regn",
            "snow": "Snö",
            "sleet": "Snöblandat regn",
            "yes": "Nederbörd",
        },
        "event_types": {},  # Trafikverket's own (Swedish) names are used as is
    },
    "en": {
        "flow_site": "Traffic flow {id}",
        "road": "Road condition {road} {id}",
        "road_default": "Road",
        "weather_station": "Weather station {name}",
        "event": "{type} {road} {id}",
        "event_default": "Event",
        "road_condition": {
            "normal": "Normal",
            "difficult": "Difficult (risk of)",
            "very_difficult": "Very difficult",
            "ice_snow": "Ice and snow",
            "no_data": "No data",
        },
        "precipitation": {
            "no": "No precipitation",
            "rain": "Rain",
            "freezing_rain": "Freezing rain",
            "snow": "Snow",
            "sleet": "Sleet",
            "yes": "Precipitation",
        },
        "event_types": {
            "Olycka": "Accident",
            "Hinder": "Obstacle",
            "Vägarbete": "Road works",
            "Viktig trafikinformation": "Important traffic information",
            "Restriktion": "Restriction",
            "Trafikmeddelande": "Traffic message",
            "Färjor": "Ferries",
        },
    },
}


def language(hass: "HomeAssistant | None") -> str:
    """Return "sv" for a Swedish Home Assistant, otherwise "en"."""
    lang = (getattr(getattr(hass, "config", None), "language", None) or "en").lower()
    return "sv" if lang.startswith("sv") else "en"


def text(lang: str, key: str, **kwargs) -> str:
    """Formatted text for `key` in `lang` (falls back to English)."""
    template = TEXTS.get(lang, TEXTS["en"]).get(key) or TEXTS["en"][key]
    return " ".join(str(template).format(**kwargs).split())


def road_condition_text(lang: str, code: int | None) -> str:
    key = ROAD_CONDITION_KEYS.get(code or 0, ROAD_CONDITION_NO_DATA)
    return TEXTS.get(lang, TEXTS["en"])["road_condition"][key]


def precipitation_text(lang: str, value: str | None) -> str | None:
    if not value:
        return None
    return TEXTS.get(lang, TEXTS["en"])["precipitation"].get(value, value)


def event_type_text(lang: str, message_type: str | None) -> str:
    if not message_type:
        return TEXTS.get(lang, TEXTS["en"])["event_default"]
    return TEXTS.get(lang, TEXTS["en"])["event_types"].get(message_type, message_type)
