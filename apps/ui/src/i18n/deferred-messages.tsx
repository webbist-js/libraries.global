"use client"

import type { ComponentType } from "react"

import { MergeMessages } from "./MergeMessages"

import type manifest from "./client-scopes.generated.json"

export type DeferredScopeId = keyof typeof manifest.deferred

type Messages = Record<string, unknown>
const requests = new Map<string, Promise<Messages>>()

function fetchScope(scope: DeferredScopeId): Promise<Messages> {
  // The root layout sets <html lang> to the active locale.
  const locale = document.documentElement.lang || "en"
  const key = `${locale}/${scope}`
  const cached = requests.get(key)
  if (cached) return cached
  const request = fetch(`/api/i18n/${key}`)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      return response.json() as Promise<Messages>
    })
    .catch((error: unknown) => {
      // Retry on the next open; render now with the shell's messages.
      requests.delete(key)
      console.error(`Could not load "${scope}" messages`, error)

      return {}
    })
  requests.set(key, request)

  return request
}

/**
 * Load a lazily rendered component together with the messages it uses, for
 * `next/dynamic`:
 *
 *   dynamic(() => withDeferredMessages(() => import("./Drawer"), "drawer"))
 *
 * `scripts/i18n-scopes.mjs` reads this call: the module's messages go into
 * the "drawer" deferred scope instead of every page's first load.
 */
export async function withDeferredMessages<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  scope: DeferredScopeId
): Promise<ComponentType<P>> {
  const [module, messages] = await Promise.all([load(), fetchScope(scope)])
  const Component = module.default
  function WithMessages(props: P) {
    return (
      <MergeMessages messages={messages}>
        <Component {...props} />
      </MergeMessages>
    )
  }

  return WithMessages
}
