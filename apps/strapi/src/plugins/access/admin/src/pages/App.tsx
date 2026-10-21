import { Page, useAuth, useRBAC } from "@strapi/strapi/admin"
import { Navigate, Route, Routes } from "react-router-dom"

import { PeoplePage } from "./PeoplePage"
import { PlansPage } from "./PlansPage"
import { TeamsPage } from "./TeamsPage"
import { PLUGIN_PATH } from "../components/peopleMeta"
import type { AccessSection } from "../components/PluginNav"

/** Checked once; each becomes `allowedActions.canManageX`. */
const PERMISSIONS = [
  { action: "plugin::access.manage-roles", subject: null },
  { action: "plugin::access.manage-teams", subject: null },
  { action: "plugin::access.manage-plans", subject: null },
]

/**
 * The plugin's pages: People (Role Grants) at the root, Teams and Plans
 * beside it, each behind its own permission.
 */
export function App() {
  const loading = useAuth("Access", (state) => state.isLoading)
  const permissions = useAuth("Access", (state) => state.permissions)
  const user = useAuth("Access", (state) => state.user)
  // Strapi 5's useRBAC does not recheck an unchanged permission list after
  // auth finishes. Mount it only when ready and remount on permission changes.
  if (loading) return <Page.Loading />

  return <ReadyApp key={`${user?.id}:${JSON.stringify(permissions)}`} />
}

function ReadyApp() {
  const { allowedActions, isLoading, error } = useRBAC(PERMISSIONS)
  if (error) return <Page.Error />
  const allowed: Record<AccessSection, boolean> = {
    people: !!allowedActions.canManageRoles,
    teams: !!allowedActions.canManageTeams,
    plans: !!allowedActions.canManagePlans,
  }
  const guard = (ok: boolean, page: React.ReactNode) =>
    isLoading ? <Page.Loading /> : ok ? page : <Page.NoPermissions />

  return (
    <Routes>
      <Route
        index
        element={guard(allowed.people, <PeoplePage allowed={allowed} />)}
      />
      <Route
        path="teams"
        element={guard(allowed.teams, <TeamsPage allowed={allowed} />)}
      />
      <Route
        path="plans"
        element={guard(allowed.plans, <PlansPage allowed={allowed} />)}
      />
      <Route path="*" element={<Navigate to={PLUGIN_PATH} replace />} />
    </Routes>
  )
}
