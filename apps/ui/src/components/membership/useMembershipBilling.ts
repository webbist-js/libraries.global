"use client"

import { useEffect, useState } from "react"

import type { BillingSummary } from "@/components/billing/types"
import { useMembershipRefresh } from "@/components/billing/useMembershipRefresh"

export function useMembershipBilling() {
  const refreshMembership = useMembershipRefresh()
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let refreshed = false
    const load = async () => {
      try {
        const res = await fetch("/api/billing/summary", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
          cache: "no-store",
        })
        if (!res.ok) throw new Error("billing")
        const data = (await res.json()) as BillingSummary
        if (controller.signal.aborted) return
        if (data.membership && !data.confirmationPending && !refreshed) {
          refreshed = true
          await refreshMembership()
          if (!controller.signal.aborted) await load()

          return
        }
        setSummary(data)
        setError(false)
        if (data.confirmationPending) timer = setTimeout(load, 5000)
      } catch {
        if (!controller.signal.aborted) {
          setError(true)
          timer = setTimeout(load, 10_000)
        }
      }
    }
    load()

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [reload, refreshMembership])
  const manage = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" })
      if (!res.ok) throw new Error("portal")
      const result = (await res.json()) as { url: string }
      const url = new URL(result.url)
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com")
        throw new Error("portal url")
      window.location.assign(result.url)
    } catch {
      setError(true)
      setBusy(false)
    }
  }
  const undo = async () => {
    setBusy(true)
    try {
      const response = await fetch("/api/billing/undo-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) throw new Error("undo")
      setReload((n) => n + 1)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return {
    summary,
    error,
    busy,
    reload: () => setReload((n) => n + 1),
    manage,
    undo,
  }
}

export type MembershipBillingController = ReturnType<
  typeof useMembershipBilling
>
