"use client"

import { ActionCallout } from "@/components/ds/ActionCallout"
import { useMembershipContent, useOfferValues } from "@/lib/localized-plans"

/**
 * Supporter is earned recognition at a published number of accepted
 * contributions. It is never sold and adds no tools, quota or authority.
 */
export function SupporterMilestone() {
  const m = useMembershipContent()
  const values = useOfferValues()

  return (
    <ActionCallout
      headingId="supporter-milestone-h"
      icon="mdi:star-circle-outline"
      eyebrow={m("copy.supporterEyebrow")}
      title={m("copy.supporterTitle", values)}
      action={{
        href: "/community/supporters",
        label: m("copy.meetSupporters"),
      }}
    >
      {m("copy.supporterBody", values)}
    </ActionCallout>
  )
}
