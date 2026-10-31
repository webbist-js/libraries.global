"use client"

import type { ComponentProps, ReactNode } from "react"

import { PageHero } from "@/components/ds/PageHero"

import { useOptionalDashboardOverlay } from "./DashboardOverlayContext"

/** The workspace owns its toolbar and navigation; standalone forms keep theirs. */
export function WorkspaceHero(props: ComponentProps<typeof PageHero>) {
  const workspace = useOptionalDashboardOverlay()

  return (
    <PageHero
      {...props}
      variant="card"
      breadcrumb={workspace ? undefined : props.breadcrumb}
      tabs={workspace ? undefined : props.tabs}
    />
  )
}

/** Task-oriented page headers share geometry; record heroes retain their richer slots. */
export function WorkspacePageHeader({
  title,
  lead,
  context,
  status,
  actions,
  breadcrumb,
  tabs,
  density = "page",
  back,
}: {
  readonly title: string
  readonly lead?: ReactNode
  readonly context?: ReactNode
  readonly status?: ReactNode
  readonly actions?: ReactNode
  readonly breadcrumb?: ComponentProps<typeof PageHero>["breadcrumb"]
  readonly tabs?: ReactNode
  readonly density?: "page" | "task"
  readonly back?: ComponentProps<typeof PageHero>["back"]
}) {
  return (
    <div className="workspace-page-header" data-density={density}>
      <WorkspaceHero
        title={title}
        plainTitle
        compact
        leadPlacement="left"
        lead={lead}
        meta={context}
        breadcrumb={breadcrumb}
        tabs={tabs}
        back={back}
      >
        {status || actions ? (
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {status}
            {actions}
          </div>
        ) : null}
      </WorkspaceHero>
    </div>
  )
}
