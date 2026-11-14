import os, sys, importlib.util, json
from datetime import datetime, timedelta, timezone
spec = importlib.util.spec_from_file_location("parser", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "custom_components", "trafikverket_map", "parser.py"))
p = importlib.util.module_from_spec(spec); sys.modules["parser"]=p; spec.loader.exec_module(p)
now = datetime(2026,11,13,8,30,tzinfo=timezone.utc)
body, order = p.build_request('k"ey', 61.71, 16.17, 10000, 30000, flow=True, road=True, weather=True, limit=300, minimal=True)
assert "authenticationkey='k\"ey'" in body and order == ["TrafficFlow","RoadCondition","WeatherObservation"]
assert 'radius="10000m"' in body and 'value="16.170000 61.710000"' in body
print(body[:400])
payload = {"RESPONSE":{"RESULT":[
 {"TrafficFlow":[
   {"SiteId":1,"MeasurementTime":"2026-11-13T09:29:00+01:00","VehicleType":"anyVehicle","VehicleFlowRate":600,"AverageVehicleSpeed":80.0,"SpecificLane":"lane1","MeasurementSide":"northBound","DataQuality":"good","Geometry":{"WGS84":"POINT (16.18 61.72)"}},
   {"SiteId":1,"MeasurementTime":"2026-11-13T09:29:00+01:00","VehicleType":"anyVehicle","VehicleFlowRate":200,"AverageVehicleSpeed":40.0,"SpecificLane":"lane1","MeasurementSide":"southBound","DataQuality":"degraded","Geometry":{"WGS84":"POINT (16.18 61.72)"}},
   {"SiteId":1,"MeasurementTime":"2026-11-13T09:29:00+01:00","VehicleType":"car","VehicleFlowRate":500,"AverageVehicleSpeed":82.0,"Geometry":{"WGS84":"POINT (16.18 61.72)"}},
   {"SiteId":2,"MeasurementTime":"2026-11-13T05:00:00+01:00","VehicleType":"anyVehicle","VehicleFlowRate":10,"Geometry":{"WGS84":"POINT (16.18 61.72)"}},
   {"SiteId":3,"MeasurementTime":"2026-11-13T09:29:00+01:00","VehicleType":"anyVehicle","VehicleFlowRate":10,"Geometry":{"WGS84":"POINT Z (18.0 59.3 0)"}}]},
 {"RoadCondition":[
   {"Id":"RC1","ConditionCode":2,"ConditionText":"Besvärligt","Warning":"Halka","RoadNumber":"Väg 83","Geometry":{"WGS84":"LINESTRING Z (16.10 61.70 0, 16.12 61.71 0, 16.14 61.715 0)"}},
   {"Id":"RC2","ConditionCode":1,"EndTime":"2026-11-13T07:00:00Z","Geometry":{"WGS84":"MULTILINESTRING ((16.1 61.7, 16.2 61.7))"}},
   {"Id":"RC3","ConditionCode":4,"Geometry":{"WGS84":"MULTILINESTRING ((16.1 61.7, 16.2 61.7),(16.2 61.7, 16.25 61.72))"}}]},
 {"WeatherObservation":[
   {"Id":"W1","Sample":"2026-11-13T09:20:00+01:00","Measurepoint":{"Id":2301,"Name":"Järvsö","Geometry":{"WGS84":"POINT (16.17 61.71)"}},
    "Weather":{"Precipitation":"snow"},"Air":{"Temperature":{"Value":-2.3},"RelativeHumidity":{"Value":91}},
    "Surface":{"Temperature":{"Value":-4.1},"Ice":True,"Grip":{"Value":0.42}},
    "Wind":[{"Height":6,"Speed":{"Value":2.0}},{"Height":10,"Speed":{"Value":3.5},"Direction":{"Value":220}}],
    "Aggregated30minutes":{"Precipitation":{"TotalWaterEquivalent":{"Value":0.4}}}}]}]}}
d = p.parse_response(payload, order, (61.71,16.17), 10, 30, timedelta(minutes=60), now)
assert [s.site_id for s in d.flow_sites] == [1], d.flow_sites
s = d.flow_sites[0]
assert s.total_flow == 800 and s.average_speed == 70.0 and s.min_speed == 40.0 and s.data_quality == "degraded", s
assert [r.id for r in d.road_conditions] == ["RC1","RC3"] and len(d.road_conditions[1].lines) == 2
w = d.nearest_weather
assert w.name=="Järvsö" and w.air_temperature==-2.3 and w.wind_speed==3.5 and w.wind_direction==220 and w.ice is True and w.grip==0.42 and w.precipitation_30min==0.4
# --- weather query asks only for recent samples, newest first
assert p.timespan(60) == "01:00:00" and p.timespan(15) == "00:15:00" and p.timespan(1500) == "1.01:00:00"
wq = body[body.index('objecttype="WeatherObservation"')-7:]
assert 'orderby="Sample desc"' in wq and '<GT name="Sample" value="$dateadd(-01:00:00)" />' in wq, wq[:400]
assert 'limit="300"' in wq
body2, _ = p.build_request("k", 61.71, 16.17, 1000, 1000, flow=False, road=False, weather=True, limit=20, minimal=True, max_age_min=30)
assert '$dateadd(-00:30:00)' in body2 and 'limit="200"' in body2

# --- regression: many old observations + a few recent ones -> latest per station is used
old = [{"Id": f"o{i}", "Sample": f"2026-11-0{1+i%7}T10:00:00+01:00",
        "Measurepoint": {"Id": 2301, "Name": "Järvsö", "Geometry": {"WGS84": "POINT (16.17 61.71)"}},
        "Air": {"Temperature": {"Value": 5.0}}} for i in range(100)]
recent = [{"Id": "n1", "Sample": "2026-11-13T09:20:00+01:00",
           "Measurepoint": {"Id": 2301, "Name": "Järvsö", "Geometry": {"WGS84": "POINT (16.17 61.71)"}},
           "Air": {"Temperature": {"Value": -1.0}}},
          {"Id": "n2", "Sample": "2026-11-13T09:25:00+01:00",
           "Measurepoint": {"Id": 2301, "Name": "Järvsö", "Geometry": {"WGS84": "POINT (16.17 61.71)"}},
           "Air": {"Temperature": {"Value": -1.5}}}]
dw = p.parse_response({"RESPONSE": {"RESULT": [{"WeatherObservation": old + recent}]}},
                      ["WeatherObservation"], (61.71, 16.17), 10, 30, timedelta(minutes=60), now)
assert len(dw.weather_stations) == 1 and dw.nearest_weather.air_temperature == -1.5, dw.weather_stations

# --- one failing data set does not hide the others
mixed = {"RESPONSE": {"RESULT": [payload["RESPONSE"]["RESULT"][0], payload["RESPONSE"]["RESULT"][1],
                                 {"ERROR": {"SOURCE": "WeatherObservation", "MESSAGE": "Bad filter"}}]}}
dm = p.parse_response(mixed, order, (61.71, 16.17), 10, 30, timedelta(minutes=60), now)
assert dm.flow_sites and dm.road_conditions and not dm.weather_stations
assert "WeatherObservation" in dm.errors and "Bad filter" in dm.errors["WeatherObservation"]

# --- all failing with auth error -> auth exception
try:
    p.parse_response({"RESPONSE":{"RESULT":[{"ERROR":{"SOURCE":"Request","MESSAGE":"Invalid authentication"}}]}}, ["RoadCondition"], (0,0),1,1,timedelta(1))
    raise SystemExit("no error")
except p.TrafikverketResponseError as e:
    assert e.auth
# --- real API response (Järvsö, 2026-11-13, no ids included) -> 5 stations, latest sample each
fixture = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "weather_jarvso.json")
real = json.load(open(fixture, encoding="utf-8"))
dr = p.parse_response(real, ["WeatherObservation"], (61.7095, 16.1717), 10, 30, timedelta(minutes=60),
                      datetime(2026, 11, 13, 9, 8, tzinfo=timezone.utc))
assert [w.name for w in dr.weather_stations] == ["Edevågen", "Snäre", "Ljusdal", "Simeå", "Färila"], dr.weather_stations
assert all(w.sample.minute == 5 for w in dr.weather_stations)
assert dr.nearest_weather.name == "Edevågen" and dr.nearest_weather.air_temperature == -0.4

# --- Situation (traffic events)
bs, ords = p.build_request("k", 61.71, 16.17, 10000, 30000, flow=False, road=False, weather=False,
                           situation=True, limit=100, minimal=True)
assert ords == ["Situation"] and 'objecttype="Situation" namespace="road.trafficinfo" schemaversion="1.6"' in bs
bv, _ = p.build_request("k", 61.71, 16.17, 10000, 30000, flow=False, road=False, weather=False, situation=True,
                        limit=100, minimal=True, versions={"Situation": "1.7"})
assert 'schemaversion="1.7"' in bv
assert '<WITHIN name="Deviation.Geometry.Point.WGS84" shape="center" value="16.170000 61.710000" radius="10000m" />' in bs
assert "<INCLUDE>Deviation.Geometry.Line.WGS84</INCLUDE>" in bs
assert "<INCLUDE>Deviation.Id</INCLUDE>" not in bs   # rejected by the API (v1.2.5 bug)
bx, _ = p.build_request("k", 61.71, 16.17, 10000, 30000, flow=False, road=False, weather=False, situation=True,
                        limit=100, minimal=True, exclude={"Situation.Deviation.RoadName"})
assert "<INCLUDE>Deviation.RoadName</INCLUDE>" not in bx and "<INCLUDE>Deviation.Header</INCLUDE>" in bx
sit_payload = {"RESPONSE": {"RESULT": [{"Situation": [
  {"Id": "S1", "Deviation": [
    {"Id": "D1", "MessageType": "Olycka", "Header": "Trafikolycka", "Message": "Två bilar inblandade.",
     "SeverityCode": 4, "SeverityText": "Stor påverkan", "RoadNumber": "Väg 83",
     "StartTime": "2026-11-13T09:20:00+01:00", "Geometry": {"Point": {"WGS84": "POINT (16.20 61.72)"}}},
    {"Id": "D2", "MessageType": "Vägarbete", "Header": "Beläggningsarbete", "SeverityCode": 2,
     "StartTime": "2026-11-01T07:00:00+01:00", "EndTime": "2026-12-01T17:00:00+01:00",
     "Geometry": {"Point": {"WGS84": "POINT (16.15 61.70)"}, "Line": {"WGS84": "LINESTRING (16.14 61.70, 16.16 61.70)"}}}]},
  {"Id": "S2", "Deviation": {"Id": "D3", "MessageType": "Hinder", "Header": "Fordon i diket", "SeverityCode": 3,
     "StartTime": "2026-11-13T09:00:00+01:00", "Geometry": {"Point": {"WGS84": "POINT (16.30 61.75)"}}}},
  {"Id": "S3", "Deviation": [{"Id": "D4", "MessageType": "Olycka", "StartTime": "2026-11-13T09:00:00+01:00",
     "Geometry": {"Point": {"WGS84": "POINT (18.06 59.33)"}}}]},            # Stockholm – outside radius
  {"Id": "S4", "Deviation": [{"Id": "D5", "MessageType": "Hinder", "StartTime": "2026-11-12T09:00:00+01:00",
     "EndTime": "2026-11-12T12:00:00+01:00", "Geometry": {"Point": {"WGS84": "POINT (16.17 61.71)"}}}]},  # ended
  {"Id": "S5", "Deviation": [{"Id": "D6", "MessageType": "Vägarbete", "StartTime": "2026-11-20T07:00:00+01:00",
     "Geometry": {"Point": {"WGS84": "POINT (16.17 61.71)"}}}]},            # planned
]}]}}
dsit = p.parse_response(sit_payload, ["Situation"], (61.71, 16.17), 10, 30, timedelta(minutes=60), now)
assert [x.id for x in dsit.situations] == ["D1", "D3", "D2"], [x.id for x in dsit.situations]
assert [x.id for x in dsit.warnings] == ["D1", "D3"]
assert dsit.situations[0].header == "Trafikolycka" and dsit.situations[0].severity_code == 4
assert dsit.situations[2].lines and dsit.active_warning_count == 2
dsit.road_conditions = d.road_conditions  # RC1 (code 2) + RC3 (code 4) from earlier
assert dsit.active_warning_count == 4

print("ALL OK")
