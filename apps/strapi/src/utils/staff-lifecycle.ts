import { refreshNoticeEffects } from "./library-notices"
import { notifySessionInvalidated, syncDerivedRole } from "./role-grants"
import { listStaff, loadStaffClaims } from "./staff"
import { afterStaffCommit, notifyStaffChange } from "./staff-notifications"

export async function onStaffChanged(
  strapi: any,
  input: { libraryDocumentId: string; baUserId: string; change: string }
): Promise<void> {
  const members = await listStaff(strapi, input.libraryDocumentId)
  await strapi.db.query("api::library.library").updateMany({
    where: { documentId: input.libraryDocumentId },
    data: { hasStaff: members.length > 0 },
  })
  const member = members.find((row) => row.baUserId === input.baUserId)
  if (!member || !member.canGoLive)
    await strapi
      .plugin("mobile-libraries")
      ?.service("live")
      ?.revokeFor(input.baUserId, input.libraryDocumentId)
  if (
    !member &&
    input.change !== "approved" &&
    (await loadStaffClaims(strapi, input.baUserId)).length === 0
  ) {
    // A `verified_librarian` grant that came from a claim or a Team
    // assignment ends with the last membership; admin grants stay.
    await strapi.db.query("api::role-grant.role-grant").updateMany({
      where: {
        baUserId: input.baUserId,
        role: "verified_librarian",
        source: { $in: ["claim", "team"] },
      },
      data: { expiresAt: new Date().toISOString() },
    })
    await syncDerivedRole(strapi, input.baUserId)
  }
  await notifySessionInvalidated(strapi, input.baUserId)
  await afterStaffCommit(
    strapi,
    `staff search refresh for ${input.libraryDocumentId}`,
    () => refreshNoticeEffects(strapi, input.libraryDocumentId)
  )
  if (input.change === "removed")
    await notifyStaffChange(
      strapi,
      input.baUserId,
      input.libraryDocumentId,
      "removed"
    )
}
