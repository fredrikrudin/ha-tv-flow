"""The schema library of the running Home Assistant version.

Home Assistant replaced voluptuous with probatio. Schemas handed to Home Assistant
(config flow forms, websocket commands) must be built with the library it uses
itself, so take it from Home Assistant's own config validation module.
"""

from __future__ import annotations

from homeassistant.helpers import config_validation as _cv

vol = getattr(_cv, "probatio", None) or getattr(_cv, "vol")
