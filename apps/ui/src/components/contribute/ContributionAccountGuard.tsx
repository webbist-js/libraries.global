"use client"

import type { ReactNode } from "react"

import { AccountGuard } from "@/components/auth/AccountGuard"

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
      publicGuestPaths={["/contribute", "/contribute/membership"]}
    >
      {children}
    </AccountGuard>
  )
}
