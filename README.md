# ha-tv-flow – Trafikverket Trafikkarta for Home Assistant

🇬🇧 **English** · 🇸🇪 [Svenska](README.sv.md)

Custom integration for Home Assistant that fetches **traffic flow**, **road conditions** and **road weather** from the Swedish Transport Administration's (Trafikverket) open API and shows them on a map around your home (or any place in Sweden).

> **Note:** This is an independent hobby project. It is **not** affiliated with, endorsed by or sponsored by Trafikverket in any way. We just appreciate their open API! 💚

- 🚗 **Traffic flow** (TrafficFlow 1.5) – measurement sites coloured by average speed and sized by flow (vehicles/h), with details per lane and direction.
- 🛣️ **Road conditions** (RoadCondition 1.3) – road sections drawn as lines, coloured by condition, with warnings, cause and action.
- 🧪 **Experimental:** accidents, obstacles and road works as their own layer on the map.
- 🌡️ **Local weather** (WeatherObservation 2.1) – nearest road weather station as a `weather` entity and sensors (air and road surface temperature, wind, precipitation, visibility, grip).
- 📍 **Any radius** around your home or a searched place.
- 📉 **Limited data usage** – you choose the update interval, max number of objects, which data sets are fetched and that only the needed fields are requested. Everything is fetched in **one** request per interval.
- 🛒 **Install via Marketplace** (Home Assistant 2026.11+) or HACS.
- 🗂️ **Automatic dashboard** – choose order and content in the settings.
- 🧭 **Setup guide** in several steps: API key → search for a place or pick on a map → radius → data usage.
- 🌍 **English and Swedish** – the UI follows Home Assistant's language.

---

## 1. Get an API key (free)

1. Go to <https://api.trafikinfo.trafikverket.se/> and click **Logga in / Registrera** (log in / register).
2. Create an account and confirm your e-mail address.
3. Log in, go to **Mina nycklar** (my keys) and create a new key.
4. Copy the key – you paste it in step 1 of the setup guide.

## 2. Install the integration

### Option A – Marketplace (Home Assistant 2026.11 and later, recommended)

1. Go to **Settings → Marketplace**.
2. Select **Add from link** in the upper right corner.
3. Enter `fredrikrudin/ha-tv-flow` (or the full GitHub address) and select **Add**. If asked for a type, choose **Integration**.
4. Install **Trafikverket Trafikkarta** and restart Home Assistant (via the repair under **Settings → System → Repairs**).
5. Continue with the setup guide below.

The first time, Marketplace asks you to accept a risk notice and connect a GitHub account.

### Option A2 – HACS (Home Assistant older than 2026.11)

1. Open **HACS** → menu (⋮) → **Custom repositories**.
2. Add `https://github.com/fredrikrudin/ha-tv-flow` with type **Integration**.
3. Search for **Trafikverket Trafikkarta**, click **Download** and restart Home Assistant.

If you later upgrade to 2026.11, the installation moves to Marketplace automatically.

### Option B – manual

1. Download the latest release (or clone the repository).
2. Copy the folder `custom_components/trafikverket_map` to `<config>/custom_components/` so that you get
   `<config>/custom_components/trafikverket_map/manifest.json`.
3. **Restart Home Assistant.**

## 3. Setup guide

**Settings → Devices & services → Add integration → "Trafikverket Trafikkarta"**

| Step | What you do |
|---|---|
| 1. API account | Paste the API key (checked right away) and optionally give a name. |
| 2. Location | Choose **Search for a town or address** or **Pick on a map**. |
| 2b. Search | Type e.g. *Järvsö* or *Storgatan 1, Sundsvall*. With several matches you pick the right one from a list. The search uses OpenStreetMap (Nominatim) and only runs in the guide. |
| 3. Position and radius | Fine-tune the marker, drag the circle or type the radius in km. |
| 4. Data usage | Update interval, which data sets to fetch, weather radius, max objects, max age of measurements and "only fetch the fields that are used". |

Everything can be changed later via **Configure** on the integration (change place, move on the map or change data usage). You can add several locations, e.g. home and a holiday house.

### Recommended settings

| Setting | Default | Comment |
|---|---|---|
| Radius | 10 km | Traffic flow sites are mainly on major roads and in larger cities. |
| Update interval | 5 min | Trafikverket updates traffic flow about every minute and weather every 10 minutes. |
| Weather radius | 30 km | The nearest station is used as local weather. |
| Max objects per query | 300 | Upper limit per data set and fetch. |
| Max age | 60 min | Hides sites that have stopped reporting. |
| Only needed fields | on | Greatly reduces the response size. |

The diagnostic sensor **Downloaded data** shows how much has been downloaded since start, and **Last response size** how large each request is – useful for fine-tuning.

## 4. Add the map to a dashboard

The integration ships its own map card, registered automatically (no resource needs to be added).

```yaml
type: custom:trafikverket-map-card
title: Traffic around home
height: 450
```

| Option | Default | Description |
|---|---|---|
| `title` | – | Heading |
| `height` | `450` | Height in pixels |
| `entry` | – | `config_entry_id` if you have several locations and want to show a specific one |
| `show_flow` / `show_road` / `show_weather` / `show_situations` | `true` | Include the layer at all |
| `show_road_works` | setting | Show road works (experimental events). Leave out to follow the *Show road works on the map* setting. |
| `event_markers` | setting | `symbols` or `text` for event markers. Leave out to follow the *Event markers* setting. |
| `legend` | `true` | Show the legend |
| `hidden` | – | Categories hidden from the start, e.g. `[speed:fast, road:1]` (see below) |
| `dark_mode` | – | `true`, `false` or `auto`. Leave out to follow the **Map style** setting under Configure → Dashboard and map. |
| `zoom_margin_km` | setting | Margin in km outside the radius in the start view. Leave out to follow the *Margin around the area at start* setting. |
| `tile_url` | OpenStreetMap | Your own tile server |

The map opens on the **chosen radius**. To see more of the surroundings, set a margin under **Configure → Dashboard and map → Margin around the area at start** (e.g. 10 km). The ⌖ button below +/– (or a click on the home marker) returns to the same view, and the map zooms again automatically when you change place or radius.

The card loads the map library Leaflet from `unpkg.com` and map tiles from OpenStreetMap, so the browser needs internet access.

### Road status – short summary

`custom:trafikverket-road-card` shows the most important facts about the road conditions in one place:

- **Status** in colour: normal, risk of slippery roads, very difficult or ice/snow. The status is the worst of Trafikverket's road condition within the radius and an estimate from the nearest weather station.
- **Why:** for example *Road surface below 0 °C*, *Dew point above road surface temperature – risk of frost*, *Snowfall* or *Poor grip*.
- **Readings:** road surface temperature, air temperature with dew point, grip (good/moderate/poor), precipitation and wind with gusts.
- **Warnings and causes** from Trafikverket, and the most difficult sections closest to you.

```yaml
type: custom:trafikverket-road-card
title: Road conditions now
max_roads: 3        # number of difficult sections in the list (0 = no list)
# entry: <config_entry_id>   # with several locations
```

Click the status row or a section to open the details. The estimate is a help and does not replace Trafikverket's assessment or your own attention. The grip classes are approximate: good ≥ 0.5, moderate 0.35–0.5, poor 0.25–0.35, very slippery < 0.25.

The card is also available as the **Road status** section of the automatic dashboard, first in the default order.

### Experimental features

**Configure → Experimental features** holds features that are still being tested. They are off by default and may change or be removed in later versions.

| Feature | What it does |
|---|---|
| **Events on the map** | Fetches Trafikverket's traffic events (Situation 1.6) within the radius and shows them as the *Events* layer of the map card: 🔴 **accidents**, 🟠 **obstacles** and 🟤 **road works**. Click a marker for heading, description, place and times. Sections are drawn as dashed lines. The sensors `sensor.tv_flow_accidents`, `_incidents` and `_road_works` are created when the feature is on. |
| **Show road works on the map** | On by default. Turn off to only show accidents and obstacles (road works also disappear from the legend). |
| **Event markers** | *Symbols* (default): coloured circle with an icon – 🚗 accident, 🛑 obstacle, 👷 road works. *Text*: coloured label with the type written out, e.g. "Accident", in the UI language. |

The layer can be hidden in the legend or with `show_situations: false` on the card. If Trafikverket rejects the query, only the events are disabled and everything else keeps working (see Troubleshooting).

### Choose what the legend shows

Click a row in the **legend** to hide or show that category on the map. Hidden rows turn grey, and **Show all** resets. The number on the right is how many objects each row has. The *Legend* heading collapses or expands the box.

The choice is saved in the browser per card and location, so the map looks the same next time. For a different starting point for all users, set `hidden:` on the card with any of these keys:

| Key | Category |
|---|---|
| `speed:fast`, `speed:medium`, `speed:slow`, `speed:crawl`, `speed:unknown` | Sites ≥ 70, 50–70, 30–50, < 30 km/h, unknown |
| `road:1`, `road:2`, `road:3`, `road:4` | Road condition normal, difficult, very difficult, ice/snow |
| `event:Olycka`, `event:Hinder`, `event:Vägarbete` | Events: accident, obstacle, road works (experimental; Trafikverket's own type names) |
| `weather` | Weather stations |

Example – only show queues and difficult road conditions from the start:

```yaml
type: custom:trafikverket-map-card
hidden: [speed:fast, speed:medium, road:1]
```

### Colours

- **Sites:** green ≥ 70 km/h, yellow-green 50–70, orange 30–50, red < 30, grey = unknown. Larger circle = more traffic.
- **Road conditions:** green normal, yellow difficult (risk of), red very difficult, blue ice and snow.
- **Events** (experimental): red accident, orange obstacle, brown road works.

### Built-in map card

All points are also `geo_location` entities and can be shown on Home Assistant's built-in map card:

```yaml
type: map
geo_location_sources:
  - trafikverket_flow
  - trafikverket_road
  - trafikverket_weather
entities:
  - zone.home
```

## 5. Ready-made dashboard

### Automatic dashboard (recommended)

The integration can build the whole dashboard for you. You choose order and content in the settings, so you never have to edit YAML.

1. **Settings → Dashboards → Add dashboard → New dashboard from scratch**, name it e.g. *Traffic*.
2. Open it and select **✏️ Edit → ⋮ → Raw configuration editor**.
3. Replace everything with:

   ```yaml
   strategy:
     type: custom:tv-flow
     title: Traffic
   ```

4. Click **Save**.

**Change order and content:** **Settings → Devices & services → Trafikverket Trafikkarta → Configure → Dashboard and map**. Choose what to show in *Position 1–7*, or *Hidden* to hide a section. There you also set the **map style** (standard OpenStreetMap, dark or follow the theme), the **margin around the area at start** and the map height. Then reload the dashboard in the browser.

Available sections:

| Section | Content |
|---|---|
| Road status | Short summary: status, why, road surface, grip, precipitation, wind, warnings |
| Roadside weather | Weather card and tiles for air, road surface, wind, humidity, precipitation, visibility and grip |
| Road conditions | Worst road condition, number of difficult sections and a list with warnings and actions |
| Traffic map | The map with sites, road conditions and weather stations (two columns wide) |
| Current situation | Warning for difficult road conditions, speed, flow and the slowest sites |
| History | Speed and temperatures over the last 24 hours, traffic flow over the last week |
| Data usage | Downloaded data and current settings |

The default order is Road status → Roadside weather → Road conditions → Traffic map → Current situation → History → Data usage. Sections whose data is turned off, e.g. weather, are skipped automatically.

With several locations, add `entry: <config_entry_id>` under `strategy:`. The value is the `config_entry_id` attribute of `sensor.tv_flow_flow_sites` (or `_2` etc.).

To change individual cards, choose **⋮ → Take control** in edit mode. The dashboard is then turned into normal YAML that you edit yourself, but it no longer follows the settings.

### Static dashboard

[`dashboards/tv-flow-dashboard.yaml`](dashboards/tv-flow-dashboard.yaml) contains the same dashboard as plain YAML in English, for those who want to edit everything themselves. A Swedish version is [`dashboards/tv-flow-dashboard.sv.yaml`](dashboards/tv-flow-dashboard.sv.yaml).

## 6. Entities

Sensors and the weather entity get fixed ids regardless of language. Further locations get `_2`, `_3` etc. The names of the `geo_location` entities follow Home Assistant's language.

| Entity | Description |
|---|---|
| `sensor.tv_flow_flow_sites` | Number of sites within the radius (also has home position and radius as attributes) |
| `sensor.tv_flow_total_flow` | Total vehicles/h |
| `sensor.tv_flow_average_speed` | Flow-weighted average speed |
| `sensor.tv_flow_lowest_speed` | Lowest average speed of the sites (queue indicator) |
| `sensor.tv_flow_road_condition` | Worst road condition within the radius. Enum sensor: the state is `normal`, `difficult`, `very_difficult`, `ice_snow` or `no_data` and is shown translated. The attribute `state_text` holds the ready-made text in Home Assistant's language. |
| `sensor.tv_flow_road_condition_count` | Number of sections with difficult road conditions |
| `weather.tv_flow` | Local weather from the nearest road weather station. Trafikverket measures the type of precipitation but not cloud cover, so the condition without precipitation is an estimate (fog when visibility < 1 km, otherwise partly cloudy/cloudy). |
| `sensor.tv_flow_air_temperature`, `_surface_temperature`, `_humidity`, `_wind_speed`, `_wind_direction`, `_precipitation`, `_precipitation_30min`, `_visibility`, `_grip` | Weather from the nearest station. `_precipitation` is an enum sensor: `no`, `rain`, `freezing_rain`, `snow`, `sleet` or `yes`. |
| `sensor.tv_flow_data_usage`, `sensor.tv_flow_response_size` | Diagnostics: downloaded data |
| `geo_location.traffic_flow_<id>` | One per site (state = distance in km). In Swedish: `geo_location.trafikflode_<id>`. |
| `geo_location.road_condition_*` | One per road condition section (Swedish: `vaglag_*`) |
| `geo_location.weather_station_*` | One per weather station (Swedish: `vaderstation_*`) |

Example automation – warn for ice:

```yaml
trigger:
  - platform: state
    entity_id: sensor.tv_flow_road_condition
    to: ice_snow
action:
  - service: notify.mobile_app_phone
    data:
      message: "Ice and snow on the roads near home."
```

## Language

The UI is available in **English and Swedish** and follows Home Assistant's language: Swedish if Home Assistant is set to Swedish, otherwise English. This covers the setup guide, the settings, sensor names and states, the card texts and the automatic dashboard. After changing language, reload the page in the browser.

Text that comes straight from Trafikverket – road names, warnings, causes and event descriptions – is always Swedish, as that is how it is delivered.

> **Since v1.5.0** `sensor.tv_flow_road_condition` and `sensor.tv_flow_precipitation` are enum sensors. If you have automations or conditions comparing with the old Swedish text, e.g. `to: "Is- och snövägbana"`, change them to the key, here `to: ice_snow` (see the table above).

## Troubleshooting

- **"Invalid API key"** – check that the whole key is pasted. If the key stops working later, Home Assistant asks for a new one automatically.
- **No sites** – there are no traffic flow detectors within the radius. Increase the radius or pick a place near a major road.
- **No weather / empty values** – open `sensor.tv_flow_data_usage` → attributes. `errors` shows any errors per data set from Trafikverket and `raw_counts` how many records came back. An error in one data set does not stop the others.
- **"Invalid query attribute …"** – if Trafikverket does not accept a field, that data set is fetched without a field list automatically. If that fails too, the data set is disabled and everything else keeps working. See the attributes `rejected_fields`, `fetched_without_field_list`, `disabled_data_sets` and `schema_overrides` on `sensor.tv_flow_data_usage`, and please report it as an issue.
- **API errors about fields** – turn off "Only fetch the fields that are used".
- Debug log:

  ```yaml
  logger:
    logs:
      custom_components.trafikverket_map: debug
  ```

## Development

`custom_components/trafikverket_map/parser.py` has no Home Assistant dependencies and is tested with

```bash
python3 tests/test_parser.py
python3 tests/test_api_retry.py
```

The API schemas (XSD) the integration is built on are in `docs/schemas/`.

## Changelog

All changes per version are in [CHANGELOG.md](CHANGELOG.md) (Swedish: [CHANGELOG.sv.md](CHANGELOG.sv.md)).

## License

[CC BY-NC 4.0](LICENSE) – free to use, share and adapt for non-commercial purposes with attribution.
Data comes from Trafikverket's open API and is used under Trafikverket's terms. Map data © OpenStreetMap contributors.

This project is not affiliated with, endorsed by or sponsored by Trafikverket. The name Trafikverket is used only to describe the source of the data.
