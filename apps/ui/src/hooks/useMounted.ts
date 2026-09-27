"use client"

import { useEffect, useState } from "react"

/**
 * False on the server and until the component has mounted in the browser.
 *
 * Forms with a secret field keep their submit button disabled until then:
 * before hydration a click, or Enter in a field, submits the form natively,
 * without the JS handler that would have sent it with fetch.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the one extra render after mount is the point (React's two-pass rendering)
  useEffect(() => setMounted(true), [])

  return mounted
}
