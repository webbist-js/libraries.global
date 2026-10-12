import type { PaidMembership } from "@repo/access"

/** Access notices only. Link owns payment receipts, invoices and recovery emails. */
export function billingNotice(
  membership: PaidMembership,
  previous: PaidMembership | null,
  now = new Date()
) {
  const activated =
    membership.status === "active" &&
    membership.paidThrough &&
    Date.parse(membership.paidThrough) > now.getTime() &&
    !membership.revoked &&
    !previous?.paidThrough
  const changed =
    previous &&
    (previous.status !== membership.status ||
      previous.cancelAtPeriodEnd !== membership.cancelAtPeriodEnd ||
      previous.revoked !== membership.revoked ||
      previous.graceExpired !== membership.graceExpired ||
      previous.plan !== membership.plan ||
      previous.interval !== membership.interval)
  if (!activated && !changed) return null
  const [title, body] = activated
    ? [
        `Your ${membership.plan === "pro" ? "Pro" : "Supporter"} membership is ready`,
        "Thank you for supporting Libraries Global. Your membership is ready. Your community role and how your edits are reviewed stay the same.",
      ]
    : membership.revoked || membership.graceExpired
      ? [
          "Your paid membership access has ended",
          "Your paid access has ended. Your free account, contributions and any complimentary access remain. Open Membership & billing for details.",
        ]
      : membership.cancelAtPeriodEnd || membership.status === "canceled"
        ? [
            "Your membership renewal has stopped",
            `Your membership will not renew. Your current paid access continues until ${membership.paidThrough ? new Date(membership.paidThrough).toLocaleDateString("en-GB") : "the end of its paid period"}. Your free account and any complimentary access remain.`,
          ]
        : previous?.cancelAtPeriodEnd && membership.status === "active"
          ? [
              "Your membership renewal has resumed",
              "Your membership will renew again. See Membership & billing for the current period and invoices.",
            ]
          : previous?.status === "past_due" && membership.status === "active"
            ? [
                "Your membership payment has recovered",
                "Your membership is active again. See Membership & billing for the current period and invoices.",
              ]
            : [
                "Your membership has changed",
                "Open Membership & billing to see your current membership, access and invoices.",
              ]

  return {
    title,
    body,
    sendEmail:
      membership.status !== "past_due" || Boolean(membership.graceExpired),
  }
}
