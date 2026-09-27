"use client"

import { useSyncExternalStore } from "react"

const noop = () => () => {}

/**
 * False on the server and until the component has mounted in the browser.
 *
 * Forms with a secret field keep their submit button disabled until then:
 * before hydration a click, or Enter in a field, submits the form natively,
 * without the JS handler that would have sent it with fetch.
 */
export function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false
  )
}
