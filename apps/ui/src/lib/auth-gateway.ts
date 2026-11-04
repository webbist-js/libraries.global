import "server-only"

import type { Account, Session as BaseSession } from "better-auth"

import type { Session } from "./auth-contract"
import { authUpstreamHeaders, authUpstreamUrl } from "./auth-transport"

export type { Session } from "./auth-contract"
type Input = { headers: Headers; query?: Record<string, boolean> }

function dates<T>(value: T): T {
  if (Array.isArray(value)) return value.map(dates) as T
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [
        key,
        ["createdAt", "updatedAt", "expiresAt", "termsAcceptedAt"].includes(
          key
        ) && typeof field === "string"
          ? new Date(field)
          : field,
      ])
    ) as T
  }

  return value
}

async function call<T>(
  path: string,
  input: Input & { body?: unknown },
  internal = false
): Promise<T> {
  const url = authUpstreamUrl(
    `${internal ? "/api/auth-internal" : "/api/auth"}/${path}`
  )
  for (const [key, value] of Object.entries(input.query ?? {}))
    url.searchParams.set(key, String(value))
  const response = await fetch(url, {
    method: input.body === undefined ? "GET" : "POST",
    headers: authUpstreamHeaders(input.headers, input.body !== undefined),
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok)
    throw new Error(`Authentication request failed (${response.status})`)
  if (response.status === 204) return null as T

  return dates(await response.json()) as T
}

export const authGateway = {
  api: {
    getSession: async (input: Input) => {
      const result = await call<Session | null>("get-session", {
        ...input,
        query: { ...input.query, disableRefresh: true },
      })

      return result
        ? { user: dates(result.user), session: dates(result.session) }
        : null
    },
    listSessions: (input: Input) => call<BaseSession[]>("list-sessions", input),
    listUserAccounts: (input: Input) =>
      call<
        Pick<
          Account,
          "id" | "providerId" | "accountId" | "createdAt" | "updatedAt"
        >[]
      >("list-accounts", input),
    revokeOtherSessions: (input: Input) =>
      call<{ status: boolean }>("revoke-other-sessions", {
        ...input,
        body: {},
      }),
    revokeSession: (input: Input & { body: { token: string } }) =>
      call<{ status: boolean }>("revoke-session", input),
    unlinkAccount: (input: Input & { body: { accountId: string } }) =>
      call<{ status: boolean }>("unlink-account", input),
    verifyPassword: (input: Input & { body: { password: string } }) =>
      call<{ status: boolean }>("verify-password", input, true),
    deleteUser: (input: Input) =>
      call<{ success: boolean }>("delete-user", { ...input, body: {} }),
  },
}
