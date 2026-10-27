"use client"

import type {
  WidgetConfig,
  WidgetResolved,
  WidgetSelectionSpec,
} from "@repo/shared-data"
import { useEffect, useState } from "react"

import { widgetRequest } from "@/lib/widgets/client"

export function useWidgetResolution(
  teamId: string,
  spec: WidgetSelectionSpec,
  config: WidgetConfig
) {
  const [data, setData] = useState<WidgetResolved | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(true),
    [attempt, setAttempt] = useState(0)
  const [completed, setCompleted] = useState("")
  const signature = JSON.stringify({ spec, config })
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setBusy(true)
      const body = JSON.parse(signature)
      widgetRequest<WidgetResolved>(
        teamId,
        "/preview",
        "POST",
        body,
        controller.signal
      )
        .then((value) => {
          setData(value)
          setError(null)
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(e.message)
            setData(null)
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setBusy(false)
            setCompleted(signature)
          }
        })
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [teamId, signature, attempt])

  return {
    data,
    error,
    busy: busy || completed !== signature,
    retry: () => setAttempt((n) => n + 1),
  }
}
