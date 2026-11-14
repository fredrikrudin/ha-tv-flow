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
    """Rejects Situation.Deviation.Id and Situation.Deviation.RoadName, like strict validation."""
    def __init__(self): self.bodies = []
    def post(self, url, data, headers):
        body = data.decode(); self.bodies.append(body)
        for bad in ("Deviation.Id", "Deviation.RoadName"):
            if f"<INCLUDE>{bad}</INCLUDE>" in body:
                return Resp(400, {"RESPONSE": {"RESULT": [{"ERROR": {"SOURCE": "Request",
                        "MESSAGE": f"Invalid query attribute Situation.{bad}"}}]}})
        return Resp(200, {"RESPONSE": {"RESULT": [{"RoadCondition": []}, {"Situation": []}]}})

async def main():
    sess = Session()
    c = api.TrafikverketClient(sess, "KEY")
    # inject an extra invalid field to prove the loop handles several
    sys.modules["tvm.parser"].SITUATION_FIELDS.insert(1, "Deviation.Id")
    d = await c.async_fetch(61.71, 16.17, 10, 30, flow=False, road=True, weather=False, situation=True,
                            limit=50, minimal=True, max_age=timedelta(minutes=60))
    print("requests:", len(sess.bodies), "| rejected:", sorted(c.rejected_fields), "| errors:", d.errors)
    assert len(sess.bodies) == 3 and c.rejected_fields == {"Situation.Deviation.Id", "Situation.Deviation.RoadName"}
    assert "<INCLUDE>Deviation.Header</INCLUDE>" in sess.bodies[-1] and "Deviation.Id<" not in sess.bodies[-1]
    # next update: no retries needed
    await c.async_fetch(61.71, 16.17, 10, 30, flow=False, road=True, weather=False, situation=True,
                        limit=50, minimal=True, max_age=timedelta(minutes=60))
    assert len(sess.bodies) == 4
    # auth errors are not swallowed
    class AuthSession(Session):
        def post(self, url, data, headers):
            return Resp(401, {"RESPONSE": {"RESULT": [{"ERROR": {"SOURCE": "Authentication", "MESSAGE": "Invalid authentication"}}]}})
    try:
        await api.TrafikverketClient(AuthSession(), "BAD").async_fetch(61.71, 16.17, 10, 30, flow=False, road=True, weather=False,
                                                                     limit=5, minimal=True, max_age=timedelta(minutes=60))
        raise SystemExit("no auth error")
    except api.TrafikverketAuthError:
        pass
    print("RETRY OK")
asyncio.run(main())
