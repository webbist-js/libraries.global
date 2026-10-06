"use client"

import type { FeedTestCode } from "@repo/shared-data"
import { useState } from "react"

/** Runs a connection test through the proxy; the result is a code. */
export function useFeedTest() {
  const [state, setState] = useState<{
    busy: boolean
    result: FeedTestCode | null
    error: string | null
  }>({
    busy: false,
    result: null,
    error: null,
  })
  async function run(url: string, body?: unknown) {
    setState({ busy: true, result: null, error: null })
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setState({
          busy: false,
          result: null,
          error: json?.error?.message ?? "The test couldn't run. Try again.",
        })

        return null
      }
      setState({ busy: false, result: json.data.result, error: null })

      return json.data.result as FeedTestCode
    } catch {
      setState({
        busy: false,
        result: null,
        error: "The test couldn't run. Check your connection.",
      })

      return null
    }
  }

  return {
    ...state,
    run,
    reset: () => setState({ busy: false, result: null, error: null }),
  }
}
