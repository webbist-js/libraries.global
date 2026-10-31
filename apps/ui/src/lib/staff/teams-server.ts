import "server-only"

import { cache } from "react"

import type { TeamSummary } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"

/** Deduplicate the layout and page's owner-only Team summary within a request. */
export const fetchStaffTeams = cache((user: Parameters<typeof fetchStaff>[0]) =>
  fetchStaff<{ teams: TeamSummary[] }>(user, "teams/mine", "access")
)
