"use client"
import type { ComponentProps } from "react"

import ErrorPage from "../error"

export default function DashboardError(
  props: ComponentProps<typeof ErrorPage>
) {
  return (
    <div className="dashboard-recovery">
      <ErrorPage {...props} />
    </div>
  )
}
