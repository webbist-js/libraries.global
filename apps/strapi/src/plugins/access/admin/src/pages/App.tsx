import { Page, useRBAC } from "@strapi/strapi/admin"
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
  const { allowedActions, isLoading } = useRBAC(PERMISSIONS)
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
