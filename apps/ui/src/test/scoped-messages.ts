// Stand-in for "@/i18n/scoped-messages" under vitest (see vitest.config.ts).
// Page and layout tests call the route component directly, so the scope
// wrapper is transparent here; client-scopes.test.ts covers the scopes.
export function withMessages<T>(component: T): T {
  return component
}

export async function scopedMessages(): Promise<undefined> {
  return undefined
}
