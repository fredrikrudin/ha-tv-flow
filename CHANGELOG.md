# Changelog

🇬🇧 **English** · 🇸🇪 [Svenska](CHANGELOG.sv.md)

All notable changes to **ha-tv-flow (Trafikverket Trafikkarta)** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).
The newest version is at the top. Every release on GitHub is tagged `vX.Y.Z`.

## [Unreleased]

## [1.5.0] – 2026-11-16

### Added
- **English and Swedish.** The whole UI follows Home Assistant's language: Swedish if Home Assistant is set to Swedish, otherwise English. This covers the setup guide, the settings, sensor names and states, the names of the `geo_location` entities, the map card (legend, popups, footer), the road status card and the automatic dashboard.
- Static dashboard in both languages: `dashboards/tv-flow-dashboard.yaml` (English) and `dashboards/tv-flow-dashboard.sv.yaml` (Swedish). Both are generated from the automatic dashboard so they are identical.
- README and changelog in English (`README.md`, `CHANGELOG.md`). The Swedish versions are kept as `README.sv.md` and `CHANGELOG.sv.md`.
- Attributes `condition_key` on road condition entities and `message_type_text` on events.

### Changed
- ⚠️ **`sensor.tv_flow_road_condition` and `sensor.tv_flow_precipitation` are now enum sensors.** The state is a language independent key that Home Assistant shows translated: road condition `normal`, `difficult`, `very_difficult`, `ice_snow`, `no_data` and precipitation `no`, `rain`, `freezing_rain`, `snow`, `sleet`, `yes`. **Automations and conditions that compare with the old Swedish text must be updated**, e.g. `to: "Is- och snövägbana"` → `to: ice_snow`.
- The names of the `geo_location` entities follow the language, so entity ids may change, e.g. `geo_location.trafikflode_123` → `geo_location.traffic_flow_123` in English. Cards and dashboards are not affected.
- All comments in the source code and all log messages are now in English.
- Text that comes from Trafikverket (road names, warnings, causes, event texts) is still Swedish.

## [1.4.1] – 2026-11-15

### Fixed
- **The map often started far zoomed out.** In sections views the card is sometimes created before it has a size, and Leaflet then calculated the zoom for a 0×0 area. The map now fits again when the card gets its size, as long as you have not panned or zoomed yourself. The ⌖ button makes the map follow size changes again.

### Changed
- The map now starts on **exactly the chosen radius**, with a little space around the circle. Previously it was the radius + 10 km.
- New setting **Margin around the area at start** (0–50 km, default 0) under *Configure → Dashboard and map*. `zoom_margin_km` on the card still takes precedence.

### Documentation
- New note in README and LICENSE that the project is not affiliated with, endorsed by or sponsored by Trafikverket. We just appreciate their open API.

## [1.4.0] – 2026-11-14

### Added
- **Selectable legend in the map card.** Click a row to hide or show a category: speed classes for sites, road condition classes, event types and weather stations. Each row shows the number of objects, hidden rows turn grey, *Show all* resets and the heading collapses the box.
- The choice is saved in the browser per card and location.
- Card options `hidden:` (categories hidden from the start) and `legend: false` (no legend).
- The footer shows how many categories are hidden.

### Changed
- The layer control in the upper right corner is removed; the legend replaces it.

## [1.3.1] – 2026-11-14

### Fixed
- Setup failed with *"Situation does not contain schemaversion 1.5. Valid versions for Situation are 1.6"* when **Events on the map** was turned on. Situation now uses schema version **1.6**.

### Changed
- If Trafikverket changes a schema version again, the integration picks the version named in the error message and fetches again. The version is shown in the `schema_overrides` attribute of `sensor.tv_flow_data_usage`.
- Other errors that name a specific data set only disable that data set, instead of failing the whole setup.

## [1.3.0] – 2026-11-14

### Removed
- **Traffic warnings** are removed for now: the warning card `custom:trafikverket-warning-card`, the *Warnings* section of the dashboards and the sensor `sensor.tv_flow_active_warnings`. If you still have the card or the sensor in a dashboard of your own, remove them.

### Added
- The settings step **Experimental features** under Configure.
- The experimental feature **Events on the map** (off by default). It shows traffic events as the *Events* layer of the map card: red for accidents, orange for obstacles and brown for road works. Other event types are not shown. The legend gets an events section when there are events on the map.

### Changed
- Traffic events (Situation) are only fetched when the experimental feature is on. The *Fetch traffic events* setting under data sets is removed.
- The dashboard step has *Position 1–7* again.

## [1.2.7] – 2026-11-14

### Fixed
- Setup still failed, now with *"Too many invalid fields in the query"*. Trafikverket rejected more fields in the traffic events query than the retries could remove one at a time.

### Changed
- If Trafikverket rejects a field, that data set is instead fetched **without a field list** (the whole object) from the next attempt. At most one extra request is needed, and the other data sets keep their limited field lists.
- If a data set is rejected even without a field list, e.g. because of the filter field, it is **disabled** until Home Assistant restarts. Traffic, road conditions and weather keep working, and the error is shown in `errors`.
- `sensor.tv_flow_data_usage` has the new attributes `fetched_without_field_list` and `disabled_data_sets`.

## [1.2.6] – 2026-11-14

### Fixed
- Setup failed with *"Invalid query attribute Situation.Deviation.Id"*. The field `Deviation.Id` does not exist in Situation 1.5 and is removed. Events get a stable id from the situation's id instead.

### Changed
- The client fixes queries with invalid fields by itself. If Trafikverket answers *"Invalid query attribute X"*, X is removed and the query is run again right away. This applies both when the whole request is rejected and when errors come per data set. Removed fields are shown in the `rejected_fields` attribute of `sensor.tv_flow_data_usage`.

### Added
- Tests for excluded fields and retries (`tests/test_api_retry.py`).

## [1.2.5] – 2026-11-14

### Added
- The **traffic events** data set (Situation 1.5): accidents, obstacles, important traffic information, restrictions, traffic messages and road works within the radius. It can be turned on and off under the data settings.
- The **warning card** `custom:trafikverket-warning-card`. It is hidden until there is a warning within the radius (an event or a section with difficult road conditions) and then shows the events, most serious first, together with the current conditions from the nearest weather station.
- The sensors `sensor.tv_flow_active_warnings`, `_incidents`, `_accidents` and `_road_works`.
- The **Events** layer in the map card, with coloured markers and sections (`show_situations`).
- The **Warnings** section in the automatic and the static dashboard. It is hidden by a visibility condition when there is no warning.

### Changed
- **Map style** moved from *Data usage and update interval* to *Configure → Dashboard and map*.
- The dashboard step has *Position 1–8*.

### Known issue
- Setup fails because of an invalid field in the traffic events query. Fixed in 1.2.6.

## [1.2.0] – 2026-11-14

### Added
- **Road status**, the card `custom:trafikverket-road-card`: coloured status based on Trafikverket's road condition and an estimate of slipperiness, the reasons for the status (e.g. risk of frost, snowfall, low grip), road surface and air temperature with dew point, grip, precipitation, wind, warnings and the most difficult sections.
- The **Road status** section in the automatic and the static dashboard, first in the default order.
- Weather stations also have the attribute `water` (water on the road).

### Changed
- The dashboards use `dense_section_placement` so the sections fill the rows.

## [1.1.0] – 2026-11-13

### Added
- **Automatic dashboard** through the strategy `custom:tv-flow`. The whole dashboard is built from the integration's settings.
- The settings step **Dashboard**: choose a section or *Hidden* for each position, and set the map height.
- Support for several locations in the automatic dashboard (`entry:`), with filtering per location.
- `sensor.tv_flow_flow_sites` has the attributes `entity_ids`, `dashboard_sections` and `map_height`. They are not stored in the history.
- The file `dashboards/tv-flow-strategy.yaml`.

## [1.0.0] – 2026-11-13

First stable version.

### Changed
- New order in the static dashboard: Roadside weather → Road conditions → Traffic map → Current situation → History → Data usage, with four columns on wide screens.
- The map card starts zoomed out to the chosen radius + 10 km (`zoom_margin_km`).

### Fixed
- **The weather was not shown.** WeatherObservation contains all observations from the last seven days, so the query got old measurements that were then filtered out. Now only measurements from the last hour are fetched, newest first (`$dateadd`, `orderby="Sample desc"`). The fix is verified against a real API response.
- All weather stations were merged into one when id fields were missing from the response. Name and position are now used as a fallback.

### Added
- An error in one data set does not stop the others. Errors are shown in the `errors` attribute of `sensor.tv_flow_data_usage`.
- The **⌖** button and a click on the home marker zoom back to the area. The map also zooms again automatically when place or radius changes.
- A real API response (Järvsö) as a test case.

## [1.0.0-beta] – 2026-11-13

First public version.

### Added
- Custom integration for Home Assistant that fetches **traffic flow** (TrafficFlow 1.5), **road conditions** (RoadCondition 1.3) and **road weather** (WeatherObservation 2.1) from Trafikverket's open API within any radius, in one request per interval.
- **Setup guide**: API key (checked right away), search for a place or pick on a map (OpenStreetMap Nominatim), fine-tune position and radius, data usage and update interval.
- Limits on data usage: update interval, max number of objects, max age of measurements, choice of data sets and "only fetch the needed fields" (INCLUDE).
- `geo_location` entities for sites, road condition sections and weather stations.
- Summary sensors with fixed ids (`sensor.tv_flow_*`) and the weather entity `weather.tv_flow`.
- The map card `custom:trafikverket-map-card` (Leaflet + OpenStreetMap). Sites are coloured by speed and sized by flow, road conditions are drawn as lines and weather stations show the temperature.
- The **Map style** setting: standard OpenStreetMap, dark or follow the theme.
- Ready-made static dashboard (`dashboards/tv-flow-dashboard.yaml`).
- README with installation via Marketplace (Home Assistant 2026.11+), HACS and manually.
- License CC BY-NC 4.0.

[Unreleased]: https://github.com/fredrikrudin/ha-tv-flow/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.5.0
[1.4.1]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.4.1
[1.4.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.4.0
[1.3.1]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.3.1
[1.3.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.3.0
[1.2.7]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.2.7
[1.2.6]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.2.6
[1.2.5]: https://github.com/fredrikrudin/ha-tv-flow/compare/58311e7...2aebc4c
[1.2.0]: https://github.com/fredrikrudin/ha-tv-flow/compare/7b2a0f0...58311e7
[1.1.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.1.0
[1.0.0]: https://github.com/fredrikrudin/ha-tv-flow/compare/fdc1e45...4b625de
[1.0.0-beta]: https://github.com/fredrikrudin/ha-tv-flow/commit/fdc1e45
