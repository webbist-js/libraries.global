"use client"
import { useTranslations } from "next-intl"
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
  const tStatic = useTranslations("staticUi")

  const { data, isPending, error } = useHydratedSession()
  if (isPending)
    return <p role="status">{tStatic("widget.loading_your_workspace")}</p>
  if (error)
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="m-0 leading-relaxed">
          {tStatic(
            "widget.we_couldn_t_check_your_sign_in_status_reload_the_workspace_to_try_again"
          )}
        </p>
        <Button
          variant="surface"
          size="pill"
          onClick={() => window.location.reload()}
        >
          {tStatic("widget.reload_workspace")}
        </Button>
      </div>
    )
  if (!data?.user)
    return (
      <p>
        {tStatic("widget.sign_in_to_manage_your_widgets")}{" "}
        <Link
          href={`/auth/signin?callbackUrl=${encodeURIComponent(returnTo)}`}
          className="font-semibold text-(--t-accent-primary) underline underline-offset-4"
        >
          {tStatic("widget.sign_in_to_continue")}
        </Link>
        .
      </p>
    )

  return children
}
