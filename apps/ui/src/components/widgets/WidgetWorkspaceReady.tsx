"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { useHydratedSession } from "@/lib/access-client"
import { Link } from "@/lib/navigation"

/** SessionQueries replaces its account-scoped provider after initial session loading.
 * Mount editable state only after that handoff, so early input cannot be discarded. */
export function WidgetWorkspaceReady({
  children,
  returnTo = "/staff/teams/widgets",
}: {
  readonly returnTo?: string
  readonly children: ReactNode
}) {
  const { data, isPending, error } = useHydratedSession()
  if (isPending) return <p role="status">Loading your workspace…</p>
  if (error)
    return (
      <div role="alert" className="space-y-3">
        <p>Your session could not be checked. Reload to continue.</p>
        <Button
          variant="surface"
          size="pill"
          onClick={() => window.location.reload()}
        >
          Reload workspace
        </Button>
      </div>
    )
  if (!data?.user)
    return (
      <p>
        Your session has ended.{" "}
        <Link
          href={`/auth/signin?callbackUrl=${encodeURIComponent(returnTo)}`}
          className="underline"
        >
          Sign in to continue
        </Link>
        .
      </p>
    )

  return children
}
