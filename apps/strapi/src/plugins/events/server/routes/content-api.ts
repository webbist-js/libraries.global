export default [
  {
    method: "GET",
    path: "/library/:entityRef",
    handler: "events.library",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/location",
    handler: "events.location",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/global",
    handler: "events.global",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/this-week",
    handler: "events.thisWeek",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/stats",
    handler: "events.stats",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/provider-breakdown",
    handler: "events.providerBreakdown",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/top-libraries",
    handler: "events.topLibraries",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/category-breakdown",
    handler: "events.categoryBreakdown",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/heatmap",
    handler: "events.heatmap",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/featured",
    handler: "events.featured",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/event/:documentId",
    handler: "events.event",
    config: { auth: false },
  },
  {
    method: "GET",
    path: "/event/:documentId/related",
    handler: "events.relatedEvents",
    config: { auth: false },
  },
]
