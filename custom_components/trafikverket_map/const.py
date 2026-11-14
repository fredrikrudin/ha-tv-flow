"""Constants for the Trafikverket Trafikkarta integration."""

from __future__ import annotations

DOMAIN = "trafikverket_map"
NAME = "Trafikverket Trafikkarta"
ATTRIBUTION = "Data från Trafikverket (Trafikverkets öppna API)"

API_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json"

# Config / options keys
CONF_RADIUS = "radius_km"
CONF_WEATHER_RADIUS = "weather_radius_km"
CONF_SCAN_INTERVAL = "scan_interval_min"
CONF_ENABLE_FLOW = "enable_traffic_flow"
CONF_ENABLE_ROAD = "enable_road_condition"
CONF_ENABLE_WEATHER = "enable_weather"
# Experimental: traffic events (Situation) as a layer on the map. Off by default.
CONF_EXPERIMENTAL_EVENTS = "experimental_events"
CONF_MAX_OBJECTS = "max_objects"
CONF_MINIMAL_FIELDS = "minimal_fields"
CONF_MAX_AGE = "max_age_min"
CONF_MAP_STYLE = "map_style"
CONF_DASHBOARD_SECTIONS = "dashboard_sections"
CONF_MAP_HEIGHT = "map_height"

DEFAULT_RADIUS_KM = 10.0
DEFAULT_WEATHER_RADIUS_KM = 30.0
DEFAULT_SCAN_INTERVAL_MIN = 5
DEFAULT_MAX_OBJECTS = 300
DEFAULT_MAX_AGE_MIN = 60
DEFAULT_MAP_STYLE = "light"
MAP_STYLES = ["light", "dark", "auto"]

# Sections of the generated dashboard (custom:tv-flow strategy), in default order
DASHBOARD_SECTIONS = ["summary", "weather", "road", "map", "now", "history", "data"]
DASHBOARD_NONE = "none"
DEFAULT_MAP_HEIGHT = 560

MIN_SCAN_INTERVAL_MIN = 1
MAX_SCAN_INTERVAL_MIN = 1440
MIN_RADIUS_KM = 0.5
MAX_RADIUS_KM = 100.0

# geo_location sources (used by the map card and by the built-in map card)
SOURCE_FLOW = "trafikverket_flow"
SOURCE_ROAD = "trafikverket_road"
SOURCE_WEATHER = "trafikverket_weather"
SOURCE_SITUATION = "trafikverket_situation"

SIGNAL_UPDATE = f"{DOMAIN}_update_{{}}"

CARD_URL = f"/{DOMAIN}/trafikverket-map-card.js"
ROAD_CARD_URL = f"/{DOMAIN}/trafikverket-road-card.js"
CARD_VERSION = "1.3.0"
