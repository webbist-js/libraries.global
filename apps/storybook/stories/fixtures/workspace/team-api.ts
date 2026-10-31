import { contributionAccountScope } from "@/lib/contribution-account-scope"
import type { apiWorkspaceAccess } from "@/lib/team-api/workspace"

import { profileResponses } from "./profile"
import { apiDashboard, staffResponses } from "./staff"
import {
  readerSession,
  type FixtureSession,
} from "../../../.storybook/FixtureSession"

type ApiWorkspaceAccess = Awaited<ReturnType<typeof apiWorkspaceAccess>>

const team = {
  id: "example-team",
  name: "Example Library Team",
  slug: "example-library-team",
  role: "organiser",
  libraryCount: 3,
  status: "active",
  expiresAt: null,
} as const

export const apiOrganiserSession = {
  ...readerSession,
  user: { ...readerSession.user, teams: [team] },
} satisfies NonNullable<FixtureSession>

export const apiMemberSession = {
  ...readerSession,
  user: { ...readerSession.user, teams: [{ ...team, role: "member" }] },
} satisfies NonNullable<FixtureSession>

export const apiConflictSession = {
  ...readerSession,
  user: {
    ...readerSession.user,
    teams: [
      team,
      {
        ...team,
        id: "example-second-team",
        name: "Example Regional Team",
        slug: "example-regional-team",
      },
    ],
  },
} satisfies NonNullable<FixtureSession>

export const guestApiAccess = {
  signedIn: false,
  scope: "guest",
  data: null,
  unavailable: false,
  conflict: false,
  showUsageWarning: true,
} satisfies ApiWorkspaceAccess

export const signedInApiAccess = {
  ...guestApiAccess,
  signedIn: true,
  scope: contributionAccountScope(readerSession.user),
} satisfies ApiWorkspaceAccess

export const memberApiAccess = {
  ...guestApiAccess,
  signedIn: true,
  scope: contributionAccountScope(apiMemberSession.user),
  data: {
    ...apiDashboard,
    organiser: false,
    active: false,
    membership: null,
    keys: [],
    days: [],
    endpoints: [],
    usage: { ...apiDashboard.usage, requests: 0, bytes: 0 },
  },
} satisfies ApiWorkspaceAccess

export const activeApiAccess = {
  ...guestApiAccess,
  signedIn: true,
  scope: contributionAccountScope(apiOrganiserSession.user),
  data: apiDashboard,
} satisfies ApiWorkspaceAccess

export const unavailableApiAccess = {
  ...activeApiAccess,
  data: null,
  unavailable: true,
} satisfies ApiWorkspaceAccess

export const conflictApiAccess = {
  ...guestApiAccess,
  signedIn: true,
  scope: contributionAccountScope(apiConflictSession.user),
  conflict: true,
} satisfies ApiWorkspaceAccess

const exampleLibraryResponse = {
  data: [
    {
      entityRef: "EXAMPLE-LIBRARY",
      name: "Northbridge Library",
      city: "Northbridge",
    },
  ],
}

export const apiWorkspaceResponses = {
  ...profileResponses,
  ...staffResponses,
  "POST /api/v1/search/libraries": { body: exampleLibraryResponse },
  "GET /api/v1/libraries": { body: exampleLibraryResponse },
  "GET /api/v1/libraries/EXAMPLE-LIBRARY": { body: exampleLibraryResponse },
}
