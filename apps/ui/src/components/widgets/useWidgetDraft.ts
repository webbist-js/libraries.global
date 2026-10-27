"use client"

import type { TeamWidget } from "@repo/shared-data"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  widgetDraft,
  widgetRequest,
  type WidgetDraft,
} from "@/lib/widgets/client"

export function useWidgetDraft(
  teamId: string,
  initial: TeamWidget,
  active: boolean
) {
  const [widget, setWidget] = useState(initial),
    [draft, setDraft] = useState(() => widgetDraft(initial)),
    [phase, setPhase] = useState<
      "saved" | "pending" | "saving" | "failed" | "conflict"
    >("saved"),
    [error, setError] = useState<string | null>(null)
  const server = useRef(initial),
    latest = useRef(draft),
    saved = useRef(JSON.stringify(draft)),
    flight = useRef<Promise<TeamWidget | null> | null>(null),
    alive = useRef(true)
  useEffect(() => {
    alive.current = true

    return () => {
      alive.current = false
    }
  }, [])
  const edit = useCallback((update: Partial<WidgetDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...update }
      latest.current = next

      return next
    })
    setPhase((current) => (current === "conflict" ? "conflict" : "pending"))
    setError(null)
  }, [])
  const adopt = useCallback((row: TeamWidget, keepMine = false) => {
    server.current = row
    saved.current = JSON.stringify(widgetDraft(row))
    setWidget(row)
    if (!keepMine) {
      latest.current = widgetDraft(row)
      setDraft(latest.current)
    }
    setPhase(keepMine ? "pending" : "saved")
    setError(null)
  }, [])
  const save = useCallback(async (): Promise<TeamWidget | null> => {
    if (flight.current) return flight.current
    if (!active) return null
    const payload = latest.current,
      signature = JSON.stringify(payload)
    if (signature === saved.current) {
      setPhase("saved")

      return server.current
    }
    setPhase("saving")
    setError(null)
    flight.current = widgetRequest<TeamWidget>(
      teamId,
      `/${server.current.documentId}`,
      "PUT",
      { ...payload, version: server.current.draftVersion }
    )
      .then((row) => {
        server.current = row
        saved.current = signature
        if (alive.current) {
          setWidget(row)
          setPhase(
            JSON.stringify(latest.current) === signature ? "saved" : "pending"
          )
        }

        return row
      })
      .catch((e) => {
        if (alive.current) {
          setError(e.message)
          setPhase(e.code === "version_conflict" ? "conflict" : "failed")
        }

        return null
      })
      .finally(() => {
        flight.current = null
      })

    return flight.current
  }, [teamId, active])
  const signature = JSON.stringify(draft)
  useEffect(() => {
    if (!active || phase !== "pending") return
    const timer = setTimeout(() => {
      void save()
    }, 900)

    return () => clearTimeout(timer)
  }, [signature, phase, widget.draftVersion, active, save])
  useEffect(() => {
    if (phase === "saved") return
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", prevent)

    return () => window.removeEventListener("beforeunload", prevent)
  }, [phase])
  const load = async (keepMine = false) => {
    try {
      const row = await widgetRequest<TeamWidget>(
        teamId,
        `/${initial.documentId}`
      )
      adopt(row, keepMine)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return { widget, draft, edit, adopt, phase, error, save, load }
}
