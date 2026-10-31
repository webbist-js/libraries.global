"use client"

import type { ReactNode } from "react"

import { AccountGuard } from "@/components/auth/AccountGuard"
import { CONTRIBUTION_DISCOVERY_PATHS } from "@/lib/feature-access"

/** Contribution pages also invalidate local state when their authority changes. */
export function ContributionAccountGuard({
  expectedScope,
  children,
}: {
  readonly expectedScope: string
  readonly children: ReactNode
}) {
  return (
    <AccountGuard
      expectedScope={expectedScope}
      publicGuestPaths={CONTRIBUTION_DISCOVERY_PATHS}
    >
      {children}
    </AccountGuard>
  )
}
