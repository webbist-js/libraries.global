/** Proposed read-only resources. These are documentation, not callable API routes or key scopes. */
export const API_ROADMAP = [
  {
    title: "Opening hours",
    path: "/api/v1/libraries/{entityRef}/opening-hours",
    detail:
      "Plan visits with date-specific hours, closures and the Library’s time zone.",
  },
  {
    title: "Public Events",
    path: "/api/v1/events",
    detail:
      "Build a local programme using date, place and Library filters, with cancellation status.",
  },
  {
    title: "Library changes",
    path: "/api/v1/libraries/changes",
    detail:
      "Keep a local directory current with a cursor-based feed of published updates and removals.",
  },
  {
    title: "Facilities and services",
    path: "/api/v1/facilities",
    detail:
      "Use stable filter identifiers and translated descriptions for accessibility, amenities and services.",
  },
] as const
