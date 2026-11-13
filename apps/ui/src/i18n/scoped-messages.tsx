import { getMessages } from "next-intl/server"
import type { ReactNode } from "react"

import { MergeMessages } from "./MergeMessages"
import { pickMessages } from "./pick-messages"

import manifest from "./client-scopes.generated.json"

/**
 * Client message scopes.
 *
 * The server has every message. The browser gets only what the client
 * components of the current route use: the root layout sends the shell's
 * messages, and each page or layout wrapped in `withMessages` adds its own.
 * `scripts/i18n-scopes.mjs` works the scopes out from the import graph and
 * writes `client-scopes.generated.json`; `pnpm --filter @repo/ui i18n:scopes`
 * regenerates it, and `i18n:check` and the vitest suite fail when it is stale.
 */
export type ScopeId = keyof typeof manifest.scopes

const scopes: Record<string, readonly string[]> = manifest.scopes

/** The messages a scope sends to the browser, or none if it adds nothing. */
export async function scopedMessages(scope: ScopeId) {
  const units = scopes[scope]
  if (!units?.length) return

  return pickMessages((await getMessages()) as Record<string, unknown>, units)
}

/**
 * Wrap a page or layout so its client components receive the messages they
 * use. `scope` is the route file's path under `src/app` without extension,
 * e.g. `"[locale]/(dashboard)/map/page"`; the generator checks it.
 */
export function withMessages<P extends object>(
  // Redirect-only pages return void (they never render).
  Component: (props: P) => ReactNode | Promise<ReactNode | void>,
  scope: ScopeId
) {
  const Route = Component as (props: P) => ReactNode | Promise<ReactNode>
  async function ScopedRoute(props: P) {
    const messages = await scopedMessages(scope)
    const content = <Route {...props} />

    return messages ? (
      <MergeMessages messages={messages}>{content}</MergeMessages>
    ) : (
      content
    )
  }

  return ScopedRoute
}
