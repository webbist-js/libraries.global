import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import type { RequestListener } from "node:http"
import { createServer } from "node:https"
import { tmpdir } from "node:os"
import path from "node:path"

/** Ephemeral local HTTPS host, so the same framing test works in production builds.
 * OpenSSL is used only by this opt-in local QA fixture; no key enters the repo. */
export function createWidgetHost(listener: RequestListener) {
  const directory = mkdtempSync(path.join(tmpdir(), "widget-host-"))
  const key = path.join(directory, "key.pem"),
    cert = path.join(directory, "cert.pem")
  try {
    execFileSync(
      "/usr/bin/openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-sha256",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
      ],
      { stdio: "ignore" }
    )

    return {
      server: createServer(
        { key: readFileSync(key), cert: readFileSync(cert) },
        listener
      ),
      dispose: () => rmSync(directory, { recursive: true, force: true }),
    }
  } catch (error) {
    rmSync(directory, { recursive: true, force: true })
    throw error
  }
}
