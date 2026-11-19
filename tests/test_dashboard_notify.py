import sys, types, asyncio, importlib.util
import os
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "custom_components", "trafikverket_map")
spec = importlib.util.spec_from_file_location("dashboard_notify", f"{base}/dashboard_notify.py")
dn = importlib.util.module_from_spec(spec); sys.modules["dashboard_notify"] = dn; spec.loader.exec_module(dn)

class Dash:
    def __init__(self, cfg): self.cfg = cfg
    async def async_load(self, force):
        if isinstance(self.cfg, Exception): raise self.cfg
        return self.cfg
class Bus:
    def __init__(self): self.fired = []
    def async_fire(self, ev, data): self.fired.append((ev, data))
class LovelaceData:  # new style (attribute)
    def __init__(self, d): self.dashboards = d

dashboards = {
    None: Dash({"strategy": {"type": "custom:tv-flow"}}),             # default dashboard uses our strategy
    "trafik": Dash({"strategy": {"type": "custom:tv-flow", "entry": "E1"}}),
    "energy-ish": Dash({"views": [{"title": "x"}]}),                    # normal dashboard
    "other-strategy": Dash({"strategy": {"type": "original-states"}}),
    "broken": Dash(RuntimeError("ConfigNotFound")),                    # no stored config
}
async def main():
    for style, data in (("attribute", LovelaceData(dashboards)), ("dict", {"dashboards": dashboards})):
        hass = types.SimpleNamespace(data={"lovelace": data}, bus=Bus())
        targets = await dn.async_notify_dashboards(hass)
        print(f"{style:9}: notified {targets} -> events {hass.bus.fired}")
        assert targets == [None, "trafik"] and all(e == "lovelace_updated" for e, _ in hass.bus.fired)
    hass = types.SimpleNamespace(data={}, bus=Bus())
    assert await dn.async_notify_dashboards(hass) == []          # Lovelace not loaded: no-op
    hass = types.SimpleNamespace(data={"lovelace": LovelaceData(dashboards)}, bus=Bus())
    await dn.async_notify_dashboards_later(hass, delay=0.01)
    assert len(hass.bus.fired) == 2
    print("NOTIFY OK")
asyncio.run(main())
