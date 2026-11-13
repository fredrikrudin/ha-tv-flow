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
try:
    p.parse_response({"RESPONSE":{"RESULT":[{"ERROR":{"SOURCE":"Request","MESSAGE":"Invalid authentication"}}]}}, order, (0,0),1,1,timedelta(1))
    raise SystemExit("no error")
except p.TrafikverketResponseError as e:
    assert e.auth
print("ALL OK")
