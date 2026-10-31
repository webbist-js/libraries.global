import type {
  TeamWidget,
  WidgetWorkspace,
  WidgetSelection,
} from "@repo/shared-data"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { FeatureAccessLanding } from "@/components/auth/FeatureAccessLanding"
import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Container } from "@/components/elementary/Container"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import { TeamMembershipConflict } from "@/components/staff/TeamMembershipConflict"
import { buttonVariants } from "@/components/ui/button"
import { WidgetCreate } from "@/components/widgets/WidgetCreate"
import { WidgetEditor } from "@/components/widgets/WidgetEditor"
import { WidgetSelectionEditor } from "@/components/widgets/WidgetSelectionEditor"
import { WidgetsOverview } from "@/components/widgets/WidgetsOverview"
import { WidgetWorkspaceReady } from "@/components/widgets/WidgetWorkspaceReady"
import { preferredTeams, sessionTeamsOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { Link } from "@/lib/navigation"
import { getSiteUrl } from "@/lib/seo/metadata"
import { fetchStaff } from "@/lib/staff-proxy"

type Mode = "overview" | "new" | "selection" | "build" | "publish" | "manage"
const MODE_LEADS: Record<Mode, string> = {
  overview:
    "Your library data, on your website. Create maps, directories and charts that stay connected to published records.",
  selection:
    "Choose your libraries once. Reuse the selection across maps, directories and comparisons.",
  new: "Choose a format, connect your libraries and make it your own.",
  manage:
    "Manage publication history, permitted websites and the life of your widget.",
  publish: "Check your draft, publish it and add it to your website.",
  build:
    "Shape your widget and try it in the live preview. Changes save to your draft.",
}
type WorkspaceResponse = Awaited<ReturnType<typeof fetchStaff<WidgetWorkspace>>>
type DetailResponse = Awaited<ReturnType<typeof fetchStaff<TeamWidget>>>
function workspaceData(response: WorkspaceResponse) {
  if (response.status !== 200) return null
  const body = response.body
  if (
    !body?.team ||
    !Array.isArray(body.widgets) ||
    !Array.isArray(body.selections)
  )
    return null

  return body
}
function selectionFor(data: WidgetWorkspace | null, mode: Mode, id?: string) {
  if (mode !== "selection" || id === "new" || !data) return null
  const selection = data.selections.find((s) => s.documentId === id)
  if (!selection) notFound()

  return selection
}
function pageTitle(
  mode: Mode,
  widget: TeamWidget | null,
  selection: WidgetSelection | null
) {
  switch (mode) {
    case "overview":
      return "Widgets"
    case "new":
      return "Create a widget"
    case "selection":
      return selection?.name ?? "Create library selection"

    default:
      return widget?.name ?? "Widget"
  }
}
function WorkspaceContent({
  data,
  widget,
  selection,
  mode,
  workspaceStatus,
  detailStatus,
}: {
  readonly data: WidgetWorkspace | null
  readonly widget: TeamWidget | null
  readonly selection: WidgetSelection | null
  readonly mode: Mode
  readonly workspaceStatus: number
  readonly detailStatus: number
}) {
  if (!data) return <StaffLoadError what="Widgets" status={workspaceStatus} />
  switch (mode) {
    case "overview":
      return <WidgetsOverview initial={data} />
    case "new":
      return <WidgetCreate data={data} />
    case "selection":
      return <WidgetSelectionEditor workspace={data} initial={selection} />

    default:
      if (!widget)
        return <StaffLoadError what="The widget" status={detailStatus} />

      return (
        <WidgetEditor
          key={`${widget.documentId}:${mode}`}
          workspace={data}
          initial={widget}
          mode={mode}
          siteUrl={getSiteUrl()}
        />
      )
  }
}
async function loadPage(
  user: Parameters<typeof fetchStaff>[0],
  teamId: string,
  mode: Mode,
  id?: string
) {
  const [workspace, detail] = await Promise.all([
    fetchStaff<WidgetWorkspace>(user, `teams/${teamId}/widgets`, "access"),
    id && mode !== "selection"
      ? fetchStaff<TeamWidget>(user, `teams/${teamId}/widgets/${id}`, "access")
      : Promise.resolve<DetailResponse | null>(null),
  ])
  if (
    workspace.status === 403 ||
    workspace.status === 404 ||
    detail?.status === 404
  )
    notFound()
  const data = workspaceData(workspace),
    widget =
      detail?.status === 200 && detail.body?.documentId ? detail.body : null
  const selection = selectionFor(data, mode, id)

  return {
    data,
    widget,
    selection,
    title: pageTitle(mode, widget, selection),
    workspaceStatus: workspace.status,
    detailStatus: detail?.status ?? 503,
  }
}

function widgetBreadcrumb(mode: Mode, title: string) {
  if (mode === "overview") return [{ label: "Widgets" }]

  return [
    { label: "Widgets", href: "/staff/teams/widgets" },
    ...(mode === "new" ? [{ label: title }] : []),
  ]
}

export async function WidgetsStaffPage({
  mode = "overview",
  id,
}: {
  readonly mode?: Mode
  readonly id?: string
}) {
  const session = await getSessionSSR(await headers())
  if (!session?.user && mode === "overview")
    return <FeatureAccessLanding feature="widgets" />
  if (!session?.user)
    redirect("/auth/signin?callbackUrl=%2Fstaff%2Fteams%2Fwidgets")
  const teams = preferredTeams(sessionTeamsOf(session.user))
  if (teams.length > 1) return <TeamMembershipConflict />
  const team = teams[0]
  if (!team && mode === "overview")
    return <FeatureAccessLanding feature="widgets" signedIn />
  if (!team) redirect("/staff/teams")
  if (id && id !== "new" && !isDocumentIdParam(id)) notFound()
  const page = await loadPage(session.user, team.id, mode, id)

  return (
    <>
      <WorkspacePageHeader
        density={mode === "overview" ? "page" : "task"}
        title={page.title}
        context={team.name}
        breadcrumb={[
          { label: "Staff area", href: "/staff" },
          { label: team.name, href: "/staff/teams" },
          ...widgetBreadcrumb(mode, page.title),
        ]}
        lead={MODE_LEADS[mode]}
        tabs={<StaffAreaTabs active="widgets" teamId={team.id} />}
        actions={
          mode === "overview" && page.data?.team.active ? (
            <Link
              href="/staff/teams/widgets/new"
              className={buttonVariants({ variant: "primary", size: "pill" })}
            >
              Create widget
            </Link>
          ) : undefined
        }
      />
      <Container
        className={
          mode === "overview" || mode === "new"
            ? "py-8 sm:py-10"
            : "py-5 sm:py-6"
        }
      >
        <WidgetWorkspaceReady>
          <WorkspaceContent {...page} mode={mode} />
        </WidgetWorkspaceReady>
      </Container>
    </>
  )
}
