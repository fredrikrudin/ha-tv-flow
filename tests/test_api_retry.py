import sys, types, json, asyncio, importlib.util, re
from datetime import timedelta
# --- stub aiohttp
aio = types.ModuleType("aiohttp")
class ClientError(Exception): pass
aio.ClientError = ClientError; aio.ClientSession = object
sys.modules["aiohttp"] = aio
# --- load package without Home Assistant
import os
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "custom_components", "trafikverket_map")
pkg = types.ModuleType("tvm"); pkg.__path__ = [base]; sys.modules["tvm"] = pkg
for name in ("const", "parser", "api"):
    spec = importlib.util.spec_from_file_location(f"tvm.{name}", f"{base}/{name}.py")
    mod = importlib.util.module_from_spec(spec); sys.modules[f"tvm.{name}"] = mod; spec.loader.exec_module(mod)
api = sys.modules["tvm.api"]

class Resp:
    def __init__(self, status, payload): self.status = status; self._b = json.dumps(payload).encode()
    async def __aenter__(self): return self
    async def __aexit__(self, *a): return False
    async def read(self): return self._b

class Session:
    """Rejects every Deviation.* INCLUDE, like the real API did for Situation 1.5."""
    def __init__(self): self.bodies = []
    def post(self, url, data, headers):
        body = data.decode(); self.bodies.append(body)
        m = re.search(r"<INCLUDE>(Deviation\.[\w.]+)</INCLUDE>", body)
        if m:
            return Resp(400, {"RESPONSE": {"RESULT": [{"ERROR": {"SOURCE": "Request",
                    "MESSAGE": f"Invalid query attribute Situation.{m.group(1)}"}}]}})
        return Resp(200, {"RESPONSE": {"RESULT": [{"RoadCondition": []}, {"Situation": []}]}})

def situation_query(body):
    return body[body.index('objecttype="Situation"'):]

async def main():
    sess = Session()
    c = api.TrafikverketClient(sess, "KEY")
    kw = dict(flow=False, road=True, weather=False, situation=True, limit=50, minimal=True, max_age=timedelta(minutes=60))
    d = await c.async_fetch(61.71, 16.17, 10, 30, **kw)
    print("requests:", len(sess.bodies), "| full:", c.full_objects, "| rejected:", sorted(c.rejected_fields))
    assert len(sess.bodies) == 2 and c.full_objects == {"Situation"}
    last = sess.bodies[-1]
    assert "<INCLUDE>" not in situation_query(last), "Situation should be fetched without INCLUDE"
    assert "<INCLUDE>ConditionCode</INCLUDE>" in last, "RoadCondition keeps its field list"
    # next update: straight through
    await c.async_fetch(61.71, 16.17, 10, 30, **kw)
    assert len(sess.bodies) == 3

    # a rejection that remains even without INCLUDE (e.g. the filter field):
    # Situation is switched off, road conditions keep working
    class FilterSession(Session):
        def post(self, url, data, headers):
            body = data.decode(); self.bodies.append(body)
            if 'objecttype="Situation"' in body:
                return Resp(400, {"RESPONSE": {"RESULT": [{"ERROR": {"SOURCE": "Request",
                        "MESSAGE": "Invalid query attribute Situation.Deviation.Geometry.Point.WGS84"}}]}})
            return Resp(200, {"RESPONSE": {"RESULT": [{"RoadCondition": []}]}})
    fs = FilterSession()
    fc = api.TrafikverketClient(fs, "KEY")
    d2 = await fc.async_fetch(61.71, 16.17, 10, 30, **kw)
    print("filter case: requests", len(fs.bodies), "| disabled:", list(fc.disabled_objects), "| errors:", list(d2.errors))
    assert len(fs.bodies) == 3 and "Situation" in fc.disabled_objects and d2.errors["Situation"].startswith("Avstängd")
    assert 'objecttype="Situation"' not in fs.bodies[-1] and 'objecttype="RoadCondition"' in fs.bodies[-1]
    await fc.async_fetch(61.71, 16.17, 10, 30, **kw)
    assert len(fs.bodies) == 4  # no more Situation attempts

    # only Situation selected and it is rejected -> clear error instead of empty data
    fs2 = FilterSession()
    try:
        await api.TrafikverketClient(fs2, "KEY").async_fetch(61.71, 16.17, 10, 30, **{**kw, "road": False})
        raise SystemExit("no error")
    except api.TrafikverketError as err:
        print("only situation ->", str(err)[:90])

    # wrong schema version -> learn the valid one and retry (the 1.3.0 setup error)
    class VersionSession(Session):
        def post(self, url, data, headers):
            body = data.decode(); self.bodies.append(body)
            m = re.search(r'objecttype="Situation" namespace="road.trafficinfo" schemaversion="([\d.]+)"', body)
            if m and m.group(1) != "1.7":
                return Resp(400, {"RESPONSE": {"RESULT": [{"ERROR": {"SOURCE": "Request",
                        "MESSAGE": f"Situation does not contain schemaversion {m.group(1)}. Valid versions for Situation are 1.7"}}]}})
            return Resp(200, {"RESPONSE": {"RESULT": [{"RoadCondition": []}, {"Situation": []}]}})
    vs = VersionSession(); vc = api.TrafikverketClient(vs, "KEY")
    d3 = await vc.async_fetch(61.71, 16.17, 10, 30, **kw)
    assert vc.schema_overrides == {"Situation": "1.7"} and 'schemaversion="1.7"' in vs.bodies[-1] and not d3.errors
    assert 'objecttype="Situation" namespace="road.trafficinfo" schemaversion="1.6"' in vs.bodies[0]
    print("version case: requests", len(vs.bodies), "| overrides:", vc.schema_overrides)

    # unknown error naming Situation -> only Situation is switched off
    class OddSession(Session):
        def post(self, url, data, headers):
            body = data.decode(); self.bodies.append(body)
            if 'objecttype="Situation"' in body:
                return Resp(400, {"RESPONSE": {"RESULT": [{"ERROR": {"SOURCE": "Request",
                        "MESSAGE": "Situation is temporarily unavailable"}}]}})
            return Resp(200, {"RESPONSE": {"RESULT": [{"RoadCondition": []}]}})
    os_ = OddSession(); oc = api.TrafikverketClient(os_, "KEY")
    d4 = await oc.async_fetch(61.71, 16.17, 10, 30, **kw)
    assert "Situation" in oc.disabled_objects and "Situation" in d4.errors and len(os_.bodies) == 2
    print("unknown error case: disabled", list(oc.disabled_objects))

    # unknown error that names no data set -> raised as before
    class Down(Session):
        def post(self, url, data, headers):
            return Resp(500, {"RESPONSE": {"RESULT": [{"ERROR": {"SOURCE": "Server", "MESSAGE": "Internal error"}}]}})
    try:
        await api.TrafikverketClient(Down(), "KEY").async_fetch(61.71, 16.17, 10, 30, **kw)
        raise SystemExit("no error")
    except api.TrafikverketError:
        pass

    # auth errors are not swallowed
    class AuthSession(Session):
        def post(self, url, data, headers):
            return Resp(401, {"RESPONSE": {"RESULT": [{"ERROR": {"SOURCE": "Authentication", "MESSAGE": "Invalid authentication"}}]}})
    try:
        await api.TrafikverketClient(AuthSession(), "BAD").async_fetch(61.71, 16.17, 10, 30, **kw)
        raise SystemExit("no auth error")
    except api.TrafikverketAuthError:
        pass
    print("RETRY OK")
asyncio.run(main())
