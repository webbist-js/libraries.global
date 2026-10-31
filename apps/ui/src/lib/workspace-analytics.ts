import { SUPPORTED_LOCALES } from "@repo/shared-data"

/** Fixed categories only: never derive analytics values from record names/IDs. */
const SECTIONS = {
  staff: [
    "overview",
    "claim",
    "new_library",
    "library",
    "record",
    "events",
    "notices",
    "team",
    "traffic",
    "live",
    "networks",
    "network_libraries",
    "teams",
    "widgets",
    "widget_editor",
    "widget_publish",
    "widget_selection",
  ],
  contribute: [
    "overview",
    "libraries",
    "new_library",
    "record",
    "knowledge",
    "journal",
    "article_editor",
    "editor_application",
    "submissions",
    "drives",
  ],
  moderation: [
    "overview",
    "review",
    "suggestions",
    "staff_access",
    "discussions",
  ],
  account: [
    "overview",
    "public_profile",
    "contributions",
    "following",
    "recognition",
    "notifications",
    "settings",
    "onboarding",
  ],
  editorial: ["overview"],
} as const

export type WorkspaceArea = keyof typeof SECTIONS
export type WorkspaceContext = {
  [Area in WorkspaceArea]: {
    workspace_area: Area
    workspace_section: (typeof SECTIONS)[Area][number]
    workspace_surface: "page" | "drawer"
  }
}[WorkspaceArea]
const ACTIONS = [
  "open",
  "close",
  "select",
  "filter",
  "save",
  "submit",
  "approve",
  "approve_publish",
  "reject",
  "request_changes",
  "publish",
  "withdraw",
] as const

export type WorkspaceAction = (typeof ACTIONS)[number]
export type WorkspaceOutcome = "intent" | "success" | "error"
export type WorkspaceEventName = "workspace_view" | "workspace_action"
export type WorkspaceParameters = WorkspaceContext & {
  action_type?: WorkspaceAction
  action_outcome?: WorkspaceOutcome
}
const LOCALE = new RegExp(`^/(?:${SUPPORTED_LOCALES.join("|")})(?=/|$)`)

const STAFF_LIBRARY_SECTIONS: Record<string, string> = {
  edit: "record",
  events: "events",
  notices: "notices",
  team: "team",
  traffic: "traffic",
  live: "live",
}
const ACCOUNT_SECTIONS: Record<string, string> = {
  settings: "settings",
  notifications: "notifications",
  onboarding: "onboarding",
  following: "following",
  badges: "recognition",
  contributions: "contributions",
}

function staffSection(parts: string[]): string | undefined {
  const [, child, section] = parts
  // Billing, purchase, API keys and invitation tokens have a separate owner.
  if (child === "team") return
  if (!child) return "overview"
  if (child === "claim") return "claim"
  if (child === "new") return "new_library"
  if (child === "networks")
    return section === "libraries" ? "network_libraries" : "networks"
  if (child === "teams") return teamSection(parts)

  return STAFF_LIBRARY_SECTIONS[section ?? ""] ?? "library"
}

function teamSection(parts: string[]): string | undefined {
  const section = parts[2],
    detail = parts[3],
    action = parts[4]
  if (["new", "billing", "api", "join"].includes(section ?? "")) return
  if (section !== "widgets") return "teams"
  if (detail === "selections") return "widget_selection"
  if (action === "publish") return "widget_publish"

  return detail ? "widget_editor" : "widgets"
}

function contributionSection(parts: string[]): string | undefined {
  const [, child, section] = parts
  if (!child) return "overview"
  if (child === "claim") return "libraries"
  if (child === "submissions") return "submissions"
  if (child === "correct") return "record"
  if (child === "index") return indexSection(section)
  if (child === "knowledge") return articleSection(section)
}
const indexSection = (section?: string) =>
  section === "new" ? "new_library" : section ? "record" : "libraries"
const articleSection = (section?: string) => {
  if (section === "apply") return "editor_application"
  if (section === "journal") return "journal"

  return section ? "article_editor" : "knowledge"
}
function accountSection(parts: string[]) {
  const [, child, section] = parts
  if (child === "membership") return
  if (!child) return "overview"

  return (
    ACCOUNT_SECTIONS[child] ??
    ACCOUNT_SECTIONS[section ?? ""] ??
    "public_profile"
  )
}
function moderationSection(child?: string) {
  if (!child) return "overview"
  const sections: Record<string, string> = {
    suggestions: "suggestions",
    staff: "staff_access",
    discussions: "discussions",
  }

  return sections[child] ?? "review"
}
function pageContext(area: WorkspaceArea, section?: string) {
  return sanitizeWorkspaceEvent("workspace_view", {
    workspace_area: area,
    workspace_section: section,
    workspace_surface: "page",
  }) as WorkspaceContext | undefined
}
function communityWorkspace(parts: string[]) {
  const [, child, section, detail] = parts
  if (child === "discussions" && section === "moderation")
    return pageContext("moderation", "discussions")
  const editsDrive =
    child === "drives" && (section === "new" || detail === "edit")
  if (child === "propose" || editsDrive)
    return pageContext("contribute", "drives")
}

export function workspaceRoute(pathname: string): WorkspaceContext | undefined {
  // Query strings never participate, even when called with an href.
  const parts = pathname
    .split(/[?#]/)[0]!
    .replace(LOCALE, "")
    .split("/")
    .filter(Boolean)
  const area = parts[0]
  if (area === "staff") return pageContext("staff", staffSection(parts))
  if (area === "contribute")
    return pageContext("contribute", contributionSection(parts))
  if (area === "moderation")
    return pageContext("moderation", moderationSection(parts[1]))
  if (area === "profile") return pageContext("account", accountSection(parts))
  if (area === "community") return communityWorkspace(parts)
}

export function sanitizeWorkspaceEvent(
  name: string,
  input: unknown
): WorkspaceParameters | undefined {
  if (
    !["workspace_view", "workspace_action"].includes(name) ||
    !input ||
    typeof input !== "object"
  )
    return
  const data = input as Record<string, unknown>
  if (
    typeof data.workspace_area !== "string" ||
    !Object.hasOwn(SECTIONS, data.workspace_area)
  )
    return
  const sections: readonly string[] =
    SECTIONS[data.workspace_area as WorkspaceArea]
  if (
    typeof data.workspace_section !== "string" ||
    !sections.includes(data.workspace_section) ||
    typeof data.workspace_surface !== "string" ||
    !["page", "drawer"].includes(data.workspace_surface)
  )
    return
  const clean = {
    workspace_area: data.workspace_area,
    workspace_section: data.workspace_section,
    workspace_surface: data.workspace_surface,
  } as WorkspaceParameters
  if (name === "workspace_action") {
    if (
      !ACTIONS.includes(data.action_type as WorkspaceAction) ||
      typeof data.action_outcome !== "string" ||
      !["intent", "success", "error"].includes(data.action_outcome)
    )
      return
    clean.action_type = data.action_type as WorkspaceAction
    clean.action_outcome = data.action_outcome as WorkspaceOutcome
  }

  return clean
}

export function workspacePageContext(
  context: WorkspaceContext,
  locale: string,
  origin: string
) {
  return {
    page_location: `${origin}${locale === "en" ? "" : `/${locale}`}/workspace/${context.workspace_area}/${context.workspace_surface}/${context.workspace_section}`,
    page_title: `workspace_${context.workspace_area}`,
    page_type: "workspace",
    page_referrer: "",
    content_locale: locale,
  }
}

export function workspaceView(context: WorkspaceContext) {
  try {
    return (
      typeof window !== "undefined" &&
      (window.librariesGlobalAnalytics?.trackWorkspace?.(
        "workspace_view",
        context
      ) ??
        false)
    )
  } catch {
    return false
  }
}

/** Capture consent before work starts; report only the actual response outcome. */
const droppedWorkspaceAction = () => false

export function captureWorkspaceAction(
  context: WorkspaceContext,
  action_type: WorkspaceAction
): (outcome: WorkspaceOutcome) => boolean {
  try {
    const complete =
      typeof window !== "undefined"
        ? window.librariesGlobalAnalytics?.prepareWorkspace?.({
            ...context,
            action_type,
          })
        : undefined

    return (outcome) => {
      try {
        return complete?.(outcome) ?? false
      } catch {
        return false
      }
    }
  } catch {
    return droppedWorkspaceAction
  }
}

export function workspaceNavigationAttributes(
  href: string,
  surface: "page" | "drawer" = "page"
) {
  const context = workspaceRoute(href)

  return context
    ? {
        "data-workspace-navigation": JSON.stringify({
          ...context,
          workspace_surface: surface,
        }),
      }
    : {}
}

export function captureWorkspaceRouteAction(action: WorkspaceAction) {
  const context =
    typeof window !== "undefined"
      ? workspaceRoute(window.location.pathname)
      : undefined

  return context
    ? captureWorkspaceAction(context, action)
    : droppedWorkspaceAction
}
