"use client"

import { PersonalBillingPanel } from "@/components/membership/PersonalBillingPanel"
import { useMembershipBilling } from "@/components/membership/useMembershipBilling"

/** Compatibility entry point for existing billing integrations and regression tests. */
export function MembershipBillingSection() {
  const billing = useMembershipBilling()

  return <PersonalBillingPanel billing={billing} />
}
