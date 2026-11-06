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

/**
 * Callable resources that are switched on in stages by server flags
 * (`API_SERVICE_READS_ENABLED`, `API_SUBMISSIONS_ENABLED`,
 * `API_ANALYSIS_ENABLED`, `API_NETWORK_REACH_ENABLED`). While a flag is off
 * the route answers 404 `resource_not_enabled` and nothing is metered.
 */
export const API_STAGED_RESOURCES = [
  {
    method: "GET",
    path: "/api/v1/services",
    scope: "services:read",
    detail:
      "List published library services, university systems and consortia, 50 at a time, with their type and sources.",
  },
  {
    method: "GET",
    path: "/api/v1/services/{ref}",
    scope: "services:read",
    detail: "Read one service by its stable ref, with coverage metadata.",
  },
  {
    method: "GET",
    path: "/api/v1/services/{ref}/libraries",
    scope: "services:read",
    detail:
      "List the service’s published member libraries. Membership is not staff authority.",
  },
  {
    method: "POST",
    path: "/api/v1/submissions/libraries",
    scope: "submissions:write",
    detail:
      "Propose a new library with evidence and a source licence. Moderators review it; nothing is published directly.",
  },
  {
    method: "POST",
    path: "/api/v1/submissions/corrections",
    scope: "submissions:write",
    detail:
      "Propose field-level corrections to a published library. Protected fields are refused.",
  },
  {
    method: "GET",
    path: "/api/v1/submissions/{id}",
    scope: "submissions:write",
    detail:
      "Check a proposal’s review status. Only the submitting account can.",
  },
  {
    method: "POST",
    path: "/api/v1/analysis/summary",
    scope: "analysis:run",
    detail:
      "Profile (1 credit) or coverage (5 credits) summary of a published service or place.",
  },
  {
    method: "POST",
    path: "/api/v1/analysis/reach",
    scope: "analysis:run",
    detail:
      "Walking or cycling Reach for one library (5 credits) or a service area (20 credits). Returns a job to poll, or a cached result for no credit.",
  },
  {
    method: "GET",
    path: "/api/v1/analysis/jobs/{id}",
    scope: "analysis:run",
    detail: "Job state, expiry and credit status.",
  },
  {
    method: "GET",
    path: "/api/v1/analysis/jobs/{id}/result",
    scope: "analysis:run",
    detail:
      "The completed result, below 128 KiB. Fetching it never spends a second credit.",
  },
] as const
