/**
 * A hidden document can't run a view transition: the browser rejects it
 * with "InvalidStateError: Transition was aborted because of invalid state.
 * Document hidden", which React reports as a recoverable error. Router
 * refreshes, polling and cross-tab session updates do run in background tabs,
 * so while the page is hidden this applies the update at once, with no
 * animation nobody could see, and resolves like a finished transition.
 */
export function guardHiddenViewTransitions(doc: Document = document) {
  const flagged = doc as Document & { __hiddenTransitionGuard?: true }
  const native = doc.startViewTransition?.bind(doc)
  if (!native || flagged.__hiddenTransitionGuard) return
  flagged.__hiddenTransitionGuard = true

  doc.startViewTransition = ((
    arg?: ViewTransitionUpdateCallback | StartViewTransitionOptions
  ) => {
    if (doc.visibilityState !== "hidden") return native(arg as never)
    const update = typeof arg === "function" ? arg : arg?.update
    const updateCallbackDone = Promise.resolve().then(() => update?.())
    const done = updateCallbackDone.then(() => {})
    // Like a skipped transition, but never a rejection to report.
    done.catch(() => {})

    return {
      ready: done,
      finished: done,
      updateCallbackDone: done,
      skipTransition() {},
      types: new Set(typeof arg === "object" && arg?.types ? arg.types : []),
    } as unknown as ViewTransition
  }) as Document["startViewTransition"]
}
