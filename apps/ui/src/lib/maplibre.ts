// The bundler resolves this package asset and emits a matching hashed worker.
// A relative prefix would resolve it beside this source file instead.
/* eslint-disable unicorn/relative-url-style */
export const MAP_WORKER_URL = new URL(
  "maplibre-gl/dist/maplibre-gl-worker.mjs",
  import.meta.url
).toString()
/* eslint-enable unicorn/relative-url-style */
