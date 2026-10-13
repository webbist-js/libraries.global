import {
  isPaidMembership,
  selectPaidMembership,
  type PaidMembership,
} from "@repo/access"

const UID = "api::paid-membership.paid-membership"

export async function loadPaidMembership(
  strapi: any,
  baUserId: string,
  now = new Date()
): Promise<PaidMembership | null> {
  const rows = await strapi.db.query(UID).findMany({
    where: { baUserId },
    orderBy: { createdAt: "desc" },
    limit: 100,
  })

  return selectPaidMembership(
    rows
      .map((row: { membership: unknown }) => row.membership)
      .filter(isPaidMembership)
      .filter(
        (m: PaidMembership) =>
          m.mode === (process.env.BILLING_ENV === "live" ? "live" : "sandbox")
      ),
    now
  )
}
