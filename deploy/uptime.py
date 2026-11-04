"""Uptime check, run by AWS Lambda every 5 minutes (setup: docs/DEPLOYMENT.md).

It fails when the site is down or its AI key is missing; a CloudWatch alarm on those failures emails the owner, and again
when the site recovers. Standard library only, so it deploys as this one file.
"""

import json
import os
import time
import urllib.request

URL = os.environ.get("HEALTH_URL", "https://mindly-ai.duckdns.org/api/health")


def handler(event=None, context=None):
    error = None
    for attempt in range(3):  # a single slow response shouldn't wake anyone
        try:
            with urllib.request.urlopen(URL, timeout=15) as resp:
                body = json.loads(resp.read())
            if body.get("llm_key_set") is not True:
                raise RuntimeError("the language model key is not set")
            return {"ok": True, "speech": body.get("speech")}
        except Exception as exc:  # noqa: BLE001  any failure counts as down
            error = exc
            time.sleep(5)
    raise RuntimeError(f"{URL} is not healthy: {error}")


if __name__ == "__main__":
    print(handler())
