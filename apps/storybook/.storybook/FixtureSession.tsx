import type { authClient } from "@/lib/auth-client"
import { buildSessionAccess } from "@/lib/session-access"
import { createContext, useContext, type ReactNode } from "react"

export type FixtureSession = ReturnType<typeof authClient.useSession>["data"]
const SessionContext = createContext<FixtureSession>(null)

export function FixtureSessionProvider({
  children,
  session = null,
}: {
  children: ReactNode
  session?: FixtureSession
}) {
  return <SessionContext value={session}>{children}</SessionContext>
}
const refetch = async () => {}

export function useFixtureSession() {
  return {
    data: useContext(SessionContext),
    isPending: false,
    isRefetching: false,
    error: null,
    refetch,
  }
}
export const readerSession = {
  user: {
    ...buildSessionAccess(null),
    id: "storybook-reader",
    name: "Maya Example",
    email: "maya@example.invalid",
    emailVerified: true,
    image: null,
    createdAt: new Date("2026-01-01T12:00:00Z"),
    updatedAt: new Date("2026-01-15T12:00:00Z"),
    profileLoaded: true,
    username: "example-reader",
  },
  session: {
    id: "storybook-session",
    userId: "storybook-reader",
    token: "not-a-session-token",
    createdAt: new Date("2026-01-01T12:00:00Z"),
    updatedAt: new Date("2026-01-15T12:00:00Z"),
    expiresAt: new Date("2099-01-01T12:00:00Z"),
    ipAddress: null,
    userAgent: null,
  },
} satisfies NonNullable<FixtureSession>
