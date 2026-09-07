#!/usr/bin/env python3
"""JSON-line adapter used by the Node forecasting module."""

from __future__ import annotations

import json
import sys
import traceback

from forecasting.engine import forecast


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        result = forecast(payload)
        json.dump({"ok": True, "result": result}, sys.stdout)
        return 0
    except Exception as error:  # structured failure; Node decides the user-facing message
        json.dump({"ok": False, "error": str(error), "type": type(error).__name__}, sys.stdout)
        if payload_debug := False:
            traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())