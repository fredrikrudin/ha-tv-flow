"""Map points (mapdata.py): shared by geo_location entities and the websocket API."""
import importlib.util
import os
import sys
import types
from datetime import datetime, timedelta, timezone

base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "custom_components", "trafikverket_map")
pkg = types.ModuleType("tvm"); pkg.__path__ = [base]; sys.modules["tvm"] = pkg
for name in ("parser", "texts", "mapdata"):
    spec = importlib.util.spec_from_file_location(f"tvm.{name}", os.path.join(base, f"{name}.py"))
    mod = importlib.util.module_from_spec(spec); sys.modules[f"tvm.{name}"] = mod; spec.loader.exec_module(mod)
p, md = sys.modules["tvm.parser"], sys.modules["tvm.mapdata"]

now = datetime(2026, 11, 26, 20, 0, tzinfo=timezone.utc)
payload = {"RESPONSE": {"RESULT": [
    {"TrafficFlow": [
        {"SiteId": 1, "MeasurementTime": "2026-11-26T20:55:00+01:00", "VehicleType": "anyVehicle", "VehicleFlowRate": 600,
         "AverageVehicleSpeed": 85.0, "Geometry": {"WGS84": "POINT (16.18 61.72)"}},
        {"SiteId": 2, "MeasurementTime": "2026-11-26T20:55:00+01:00", "VehicleType": "anyVehicle", "VehicleFlowRate": 900,
         "AverageVehicleSpeed": 22.0, "Geometry": {"WGS84": "POINT (16.15 61.70)"}}]},
    {"RoadCondition": [
        {"Id": "RC1", "ConditionCode": 3, "Warning": ["Halka"], "RoadNumber": "Väg 83",
         "Geometry": {"WGS84": "LINESTRING (16.10 61.70, 16.12 61.71)"}},
        {"Id": "RC2", "ConditionCode": 1, "Geometry": {"WGS84": "LINESTRING (16.13 61.70, 16.14 61.71)"}}]},
    {"WeatherObservation": [
        {"Sample": "2026-11-26T20:50:00+01:00", "Measurepoint": {"Id": 7, "Name": "Edevågen", "Geometry": {"WGS84": "POINT (16.16 61.75)"}},
         "Air": {"Temperature": {"Value": -2.0}}}]},
    {"Situation": [{"Id": "S1", "Deviation": [{"MessageType": "Vägarbete", "Header": "Beläggning", "StartTime": "2026-11-20T07:00:00+01:00",
        "Geometry": {"Point": {"WGS84": "POINT (16.17 61.71)"}}}]}]},
]}}
order = ["TrafficFlow", "RoadCondition", "WeatherObservation", "Situation"]
data = p.parse_response(payload, order, (61.71, 16.17), 10, 30, timedelta(minutes=60), now)

pts = md.map_points(data, "sv")
by = {pt.key: pt for pt in pts}
assert set(by) == {"flow_1", "flow_2", "road_RC1", "road_RC2", "weather_id:7", "situation_S1:Vägarbete:0"}, set(by)
assert by["flow_1"].picture == "flow-fast" and by["flow_2"].picture == "flow-crawl"
assert by["road_RC1"].picture == "road-3" and by["weather_id:7"].picture == "weather"
assert by["situation_S1:Vägarbete:0"].picture == "event-roadworks"
assert by["flow_2"].name == "Trafikflöde 2" and md.map_points(data, "en")[1].name == "Traffic flow 2"
# every picture exists as a file
icons = os.path.join(base, "www", "icons")
assert all(os.path.exists(os.path.join(icons, f"{pt.picture}.svg")) for pt in pts)

# signature: stable for equal data, different when something changes
again = {pt.key: pt for pt in md.map_points(data, "sv")}
assert all(again[k].signature() == by[k].signature() for k in by)
data.flow_sites[0].average_speed = 40.0
assert {pt.key: pt for pt in md.map_points(data, "sv")}["flow_1"].signature() != by["flow_1"].signature()

# websocket payload looks like a state object
pl = md.point_payload(by["flow_2"], "E1", None)
assert pl["entity_id"] == "trafikverket_map.flow_2" and pl["attributes"]["tv_type"] == "flow"
assert pl["attributes"]["config_entry_id"] == "E1" and pl["attributes"]["latitude"] == by["flow_2"].latitude
assert md.point_payload(by["flow_2"], "E1", "geo_location.trafikflode_2")["entity_id"] == "geo_location.trafikflode_2"

# dashboard lists
slow = md.slowest_sites(data)
assert [s["site_id"] for s in slow] == [2, 1] and slow[0]["average_speed"] == 22.0
roads = md.difficult_roads(data)
assert len(roads) == 1 and roads[0]["road_number"] == "Väg 83" and roads[0]["warning"] == "Halka"
print("MAPDATA OK")
