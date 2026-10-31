#!/usr/bin/env python3
"""Invoke the installed application's secret-gated maintenance endpoint.

The operator supplies runtime configuration through a protected environment file.
Never put credentials in command arguments, logs, Git or the image.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


def main():
    origin = os.environ.get("APP_PUBLIC_URL", "")
    secret = os.environ.get("CRON_SECRET", "")
    parsed = urllib.parse.urlsplit(origin)
    if (parsed.scheme != "https" or not parsed.netloc or parsed.username
            or parsed.password or parsed.query or parsed.fragment or not secret):
        raise ValueError("maintenance_configuration_invalid")
    request = urllib.request.Request(
        origin.rstrip("/") + "/api/cron/cms",
        headers={"Authorization": "Bearer " + secret},
    )
    # Refuse redirects: a misconfigured origin must not forward the bearer.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    opener = urllib.request.build_opener(NoRedirect)
    with opener.open(request, timeout=75) as response:
        result = json.loads(response.read(65536))
        if response.status != 200 or result.get("ok") is not True:
            raise ValueError("maintenance_failed")
    print("CMS maintenance completed")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, urllib.error.HTTPError):
        print("CMS maintenance failed; inspect the application's private health receipts", file=sys.stderr)
        sys.exit(1)
