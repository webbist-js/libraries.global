const route = (method: string, path: string, handler: string) => ({
  method,
  path,
  handler: `live.${handler}`,
  config: { auth: false },
})

export default {
  "content-api": {
    type: "content-api",
    routes: [
      route("GET", "/live", "public"),
      route("POST", "/live/start", "start"),
      route("POST", "/live/takeover", "takeover"),
      route("POST", "/live/locked", "locked"),
      route("GET", "/live/:sessionId", "resume"),
      route("POST", "/live/:sessionId/events", "events"),
      route("POST", "/live/:sessionId/position", "position"),
      route("POST", "/live/:sessionId/end", "end"),
      route("GET", "/libraries/:documentId/live-settings", "settings"),
      route("PUT", "/libraries/:documentId/live-settings", "updateSettings"),
      route("GET", "/libraries/:documentId/live-sessions", "log"),
      route("POST", "/libraries/:documentId/live-link", "link"),
    ],
  },
}
