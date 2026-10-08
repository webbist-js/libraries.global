import { Navigate, Route, Routes } from "react-router-dom"

import { ModerationDashboard } from "./ModerationDashboard"

/** Where the plugin's page lives, under the admin's base path. */
export const PLUGIN_PATH = "/plugins/content-moderation"

/**
 * The plugin's page: the moderation queue. People (Role Grants), Teams and
 * Plans live in the access plugin.
 */
export function App() {
  return (
    <Routes>
      <Route index element={<ModerationDashboard />} />
      <Route path="*" element={<Navigate to={PLUGIN_PATH} replace />} />
    </Routes>
  )
}
