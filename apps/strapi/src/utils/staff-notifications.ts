import { listStaff } from "./staff"
import { scheduleNotification } from "../plugins/content-moderation/server/services/notifications"

/** Register effects on the outer transaction's commit, including when called
 * from a moderation decision. A provider failure cannot undo membership. */
export async function afterStaffCommit(
  strapi: any,
  label: string,
  work: () => Promise<void>
) {
  const queue = () => scheduleNotification(strapi, label, work)
  await strapi.db.transaction(async ({ onCommit }: any) => {
    if (typeof onCommit === "function") onCommit(queue)
    else queue()
  })
}

export async function notifyStaffChange(
  strapi: any,
  user: string,
  id: string,
  action: "joined" | "removed"
) {
  await afterStaffCommit(strapi, `staff ${action} for ${id}`, async () => {
    const staff = strapi.plugin("library-staff").service("staff")
    const notifications = strapi
      .plugin("content-moderation")
      .service("notifications")
    const lib = await strapi.documents("api::library.library").findOne({
      documentId: id,
      status: "published",
      fields: ["name", "slug"],
      populate: {
        continent: { fields: ["slug"] },
        country: { fields: ["slug"] },
        region: { fields: ["slug"] },
      },
    })
    const recipients =
      action === "removed"
        ? [user]
        : (await listStaff(strapi, id))
            .filter((row) => row.staffRole === "owner" && row.baUserId !== user)
            .map((row) => row.baUserId)
    const emails: string[] = (await notifications?.emailsOf?.(recipients)) ?? []
    const name = await staff.name(user),
      library = lib?.name ?? "your library"
    const base = process.env.APP_PUBLIC_URL ?? "https://libraries.global"
    const parts = [
      lib?.continent?.slug,
      lib?.country?.slug,
      lib?.region?.slug,
      lib?.slug,
    ]
    const publicPage = parts.every(Boolean)
      ? new URL(`/${parts.join("/")}`, base)
      : null
    const report = new URL(`/contribute/correct/${lib?.slug ?? ""}`, base)
    for (const email of emails)
      await staff.mail(
        email,
        action === "joined"
          ? `${name} has joined ${library}'s staff`
          : `Your staff access to ${library} has ended`,
        action === "joined"
          ? `${name} can now help maintain ${library}'s page. Review staff access in the Team tab. If you don't recognise them, report a problem with staff access.\n\n${new URL(lib?.slug ? `/staff/${lib.slug}/team` : "/staff", base)}`
          : `Your staff access to ${library} has ended. Any live session you started has stopped. If this is unexpected, contact your library's owner, or report it to the site moderators from the library's page.${
              publicPage ? `\n\nLibrary page: ${publicPage}` : ""
            }\n\nReport a problem: ${report}`
      )
  })
}
