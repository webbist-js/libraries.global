import { Page, useRBAC } from "@strapi/strapi/admin"
import { Navigate, Route, Routes } from "react-router-dom"

import { PLUGIN_PATH } from "../components/peopleMeta"
import { ModerationDashboard } from "./ModerationDashboard"
import { PeoplePage } from "./PeoplePage"

/** Checked once; `manage-roles` becomes `allowedActions.canManageRoles`. */
const MANAGE_ROLES = [
  { action: "plugin::content-moderation.manage-roles", subject: null },
]

/**
 * The plugin's pages: the moderation queue at the root and People (Role
 * Grants) beside it, for admins with "Manage contributor roles" only.
 */
export function App() {
  const { allowedActions, isLoading } = useRBAC(MANAGE_ROLES)
  const canManageRoles = !!allowedActions.canManageRoles

  return (
    <Routes>
      <Route
        index
        element={<ModerationDashboard canManageRoles={canManageRoles} />}
      />
      <Route
        path="people"
        element={
          isLoading ? (
            <Page.Loading />
          ) : canManageRoles ? (
            <PeoplePage />
          ) : (
            <Page.NoPermissions />
          )
        }
      />
      <Route path="*" element={<Navigate to={PLUGIN_PATH} replace />} />
    </Routes>
  )
}
