/** Update local CMS copy via the admin MCP tools. Preview first; --apply writes it. */
import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"

import { StrapiMcpClient } from "./mcp-client"

const paragraph = (value: string) => ({
  type: "paragraph",
  children: [{ type: "text", text: value }],
})
const heading = (value: string) => ({
  type: "heading",
  level: 2,
  children: [{ type: "text", text: value }],
})
const section = (title: string, short: string, ...body: string[]) => ({
  heading: title,
  inShort: short,
  body: body.map(paragraph),
})
function clean(value: any): any {
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, v]) => key !== "id" && v !== null)
        .map(([key, v]) => [key, clean(v)])
    )

  return value
}
function replaceSection(sections: any[], replacement: any) {
  const index = sections.findIndex((s) => s.heading === replacement.heading)
  if (index === -1) sections.push(replacement)
  else sections[index] = replacement
}
const NOTIFICATION_GUIDE = [
  heading("Your notification inbox"),
  paragraph(
    "Open Notifications from your profile menu or the Notifications tab on your own profile. A dot on your avatar means you have unread updates; the menu shows how many. Read an update or choose Mark all as read to clear that count."
  ),
  paragraph(
    "The inbox includes reviewed submissions, public changes to libraries you follow, newly earned badges, drive results, project notices, and changes to your staff access or event feeds. Email settings do not hide those updates. The latest 50 are shown; the app removes notifications after 90 days."
  ),
  heading("Two separate weekly emails"),
  paragraph(
    "Weekly digest is an opt-in Monday email about public changes to libraries you follow. It does not arrive when none have changed."
  ),
  paragraph(
    "Weekly community report is a separate opt-in Monday email with newly published library totals, public edit batches, accepted content contributions, new Knowledge and Journal articles, and your own accepted contributions and points. It covers the previous Monday–Sunday in UTC. Imported library batches are excluded, and there is no email in a quiet week. Other people's review notes and private profiles are never included."
  ),
  heading("Other activity emails"),
  paragraph(
    "In Profile → Settings → Notifications, choose emails for reviewed contributions, completed drives, new followers, earned badges and project notices. New follower and badge emails start off. Product updates are a separate opt-in for occasional feature announcements. Turning off an activity email leaves the update in your inbox."
  ),
  paragraph(
    "Email verification, sign-in links, password resets, requested live-console messages, role application decisions, approved library claims and staff or event-feed access changes are service messages. Optional email settings do not stop them."
  ),
  heading("Newsletter and Journal dispatch"),
  paragraph(
    "The newsletter is separate from both weekly emails and product updates. It contains project news and Journal articles, at most monthly. A visitor who signs up receives a confirmation email: opening the link is not enough; choose Confirm on the page. A verified signed-in user can explicitly subscribe with their account email in Settings."
  ),
  paragraph(
    "Every optional activity email has a link to unsubscribe from that kind of email. Newsletter unsubscribe links affect only the newsletter. You can manage these choices without subscribing to anything else. Joining the beta waitlist never signs you up for the newsletter."
  ),
  heading("Notification sounds"),
  paragraph(
    "Play a sound for new notifications enables a quiet chime while the site is open and visible, after you click or press a key. Use Preview notification sound to hear it. Existing unread updates, read receipts and hidden tabs do not chime. Browser sound restrictions still apply."
  ),
  heading("If an email does not arrive"),
  paragraph(
    "Check your spam folder and that your account email is verified. Quiet weeks produce no weekly email. You can still read updates in your notification inbox. If a message is missing, contact info@libraries.global; never send a password or sign-in link."
  ),
]

async function main() {
  try {
    process.loadEnvFile(".env")
  } catch {
    /* Env can be supplied by the operator. */
  }
  const url = process.env.STRAPI_URL || "http://127.0.0.1:1337"
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url))
    throw new Error("This migration is for the local CMS only")
  const client = new StrapiMcpClient(process.env.STRAPI_MCP_TOKEN, `${url}/mcp`)
  await client.initialize()
  const legal = await client.listAll<any>("legal-document", {
    locale: "en",
    status: "draft",
  })
  const knowledge = await client.listAll<any>("wiki-article", {
    locale: "en",
    status: "draft",
  })
  const apply = process.argv.includes("--apply")
  if (apply)
    await writeFile(
      `/tmp/libraries-notification-content-before-${randomUUID()}.json`,
      JSON.stringify({ legal, knowledge }, null, 2),
      { mode: 0o600 }
    )
  for (const doc of legal.filter((d) =>
    ["privacy", "cookies", "terms", "accessibility"].includes(d.slug)
  )) {
    const sections = clean(doc.sections)
    if (doc.slug === "privacy") {
      for (const s of sections) {
        s.body = JSON.parse(
          JSON.stringify(s.body)
            .replaceAll("Mailgun Technologies, Inc.", "Brevo (Sendinblue SAS)")
            .replaceAll(
              "(United States) sends our emails.",
              "(France) delivers our account and activity emails. It receives the destination email address and message content, and keeps delivery logs. Namecheap Private Email hosts the mailbox we use to receive replies."
            )
        )
      }
      replaceSection(
        sections,
        section(
          "Emails and notifications",
          "Weekly reports, product updates and the newsletter have separate choices.",
          "We store private inbox updates, whether you have read them, your email preferences and delivery attempts. These support the account features you use. Essential account, security, role and staff-access messages are service communications; turning off optional emails does not stop them.",
          "Weekly digest covers public updates to libraries you follow. Weekly community report covers community totals, new public articles and your own contributions. Both are optional and have separate recorded opt-ins. Quiet weeks produce no email. Other users' private notes and identities are not included in either email.",
          "Product updates and the newsletter are separate optional subscriptions. We rely on your consent for these and for the two weekly emails. We record when you opt in and when you withdraw. Guest newsletter subscriptions require an email confirmation; a verified account holder can explicitly subscribe in Settings. You can withdraw each choice in Settings or through its email unsubscribe link.",
          "The beta waitlist records your email address only so we can contact you about requested beta access. It does not create an account or enrol you in any newsletter. Redeeming an individual invitation records its acceptance and grants browser access without creating or signing in to an account.",
          "Brevo handles email delivery and may route links through our branded email subdomain. Provider requests and delivery logs can include the recipient address, message, delivery time and technical information. Email engagement tracking is controlled separately in the provider account; it is not used to build advertising profiles.",
          "If an address has been exported into a newsletter mailing list, removal and suppression on that provider must also be applied separately. There is no automatic two-way mailing-list sync yet. Contact info@libraries.global if you need help withdrawing or deleting a provider-held subscription."
        )
      )
      replaceSection(
        sections,
        section(
          "Notification and subscriber retention",
          "App notifications are removed after 90 days; subscription choices are retained to honour them.",
          "We remove app notifications, their private email payloads and their app delivery-attempt records after 90 days, using a daily housekeeping job. Deleting your account removes the notifications linked to it sooner.",
          "Newsletter and beta-access records are kept while needed for their stated purpose. An unsubscribed or blocked record is retained so a retry or import does not enrol that address again. Account deletion removes linked subscriptions and subscriptions at the account email. Provider-held logs and any separately imported mailing-list records must be handled under the provider's retention and deletion controls."
        )
      )
    }
    if (doc.slug === "cookies") {
      const browser = sections.find((s: any) => s.heading === "Browser storage")
      if (browser && !JSON.stringify(browser).includes("notifications.chime:"))
        browser.body.push(
          paragraph(
            "notifications.chime: followed by your account identifier remembers the last notification that played a sound, so open tabs do not repeat the same chime. It stays in your browser until cleared and contains no password or email-link token. It supports the notification sound preference you choose."
          )
        )
      const cookies = sections.find((s: any) => s.heading === "Cookies we use")
      if (cookies && !JSON.stringify(cookies).includes("lg-beta-access"))
        cookies.body.push(
          paragraph(
            "lg-beta-access stores a signed invitation reference, expiry and access version for up to 30 days after an individual invitation is redeemed. Its reference lets us check and revoke the browser pass. It grants access to the closed beta and does not create or sign in to an account."
          )
        )
      replaceSection(
        sections,
        section(
          "Emails",
          "Email delivery is separate from cookies on this website.",
          "Brevo sends our account and activity emails. Email links may use em.libraries.global, our branded email subdomain. The website storage described here is not used to measure email engagement or for advertising. The privacy notice explains the email data handled by the delivery provider."
        )
      )
    }
    if (doc.slug === "terms")
      replaceSection(
        sections,
        section(
          "Emails and account updates",
          "Optional subscriptions are separate from essential account messages.",
          "Creating an account does not subscribe you to a newsletter, product updates or weekly emails. Choose those separately in Settings. You can stop each optional email through its unsubscribe link. Essential sign-in, security, role and staff-access communications remain part of the service.",
          "During the closed beta, visitors need an individual invitation to enter. Redeeming it does not create an account or subscribe you to emails. The beta waitlist is used only for requested access."
        )
      )
    if (doc.slug === "accessibility")
      replaceSection(
        sections,
        section(
          "Notification indicators and sound",
          "Unread updates are shown visually and in accessible labels; sound is optional.",
          "An unread dot appears on your profile avatar, and the profile menu displays the unread count. The notification inbox labels unread updates in text and lets you mark them as read. Sound starts off and is never the only way to learn about an update. You can enable and preview a quiet chime in Settings; it needs a browser interaction and a visible page."
        )
      )
    const revisions = clean(doc.revisions ?? [])
    if (
      !revisions.some(
        (r: any) =>
          r.date === "2026-10-11" && r.summary.includes("notifications")
      )
    )
      revisions.push({
        version: doc.slug === "accessibility" ? "0.2" : "0.3",
        date: "2026-10-11",
        summary:
          "Pre-launch copy updated for Brevo delivery, private notifications, separate weekly email choices and unsubscribe controls.",
      })
    if (apply) {
      await client.call("update_legal-document", {
        documentId: doc.documentId,
        locale: "en",
        data: { title: doc.title, slug: doc.slug, sections, revisions },
      })
      if (doc.status === "published" || doc.status === "modified")
        await client.call("publish_legal-document", {
          documentId: doc.documentId,
          locale: "en",
        })
    }
    console.log(`${apply ? "Updated" : "Preview"} legal: ${doc.slug}`)
  }
  for (const doc of knowledge.filter((d) =>
    [
      "your-account-and-profile",
      "deleting-your-account",
      "badges",
      "how-review-works",
      "plans-and-pro",
    ].includes(d.slug)
  )) {
    const body = clean(doc.body ?? [])
    if (doc.slug === "your-account-and-profile") {
      for (const c of body)
        if (c.__component === "content.rich-text")
          for (const b of c.body) {
            if (b.type === "list")
              for (const item of b.children)
                if (
                  JSON.stringify(item).includes(
                    "Other emails, such as a weekly digest"
                  )
                )
                  item.children = [
                    {
                      type: "text",
                      text: "Notifications: open your private inbox and choose emails for reviewed contributions, drives, followers and badges. Weekly digest and Weekly community report are separate opt-ins. Newsletter and product updates have their own choices. You can also enable a quiet notification sound.",
                    },
                  ]
          }
      if (
        !body.some((c: any) =>
          JSON.stringify(c).includes("Two separate weekly emails")
        )
      )
        body.push({
          __component: "content.rich-text",
          body: NOTIFICATION_GUIDE,
        })
    }
    if (doc.slug === "deleting-your-account") {
      for (const c of body)
        if (c.__component === "content.rich-text")
          for (const b of c.body)
            for (const text of b.children ?? [])
              if (text.text)
                text.text = text.text
                  .replace(
                    '"Deactivate" hides your profile and pauses notifications. Nothing is deleted. Sign in again whenever you like to come back.',
                    '"Hide profile and sign out" makes your profile private and ends your current session. It does not pause emails. Turn optional emails off in Notifications settings first if that is what you want. Nothing is deleted; you can sign in again.'
                  )
                  .replace("Deactivating", "Hiding your profile")
      if (
        !body.some((c: any) =>
          JSON.stringify(c).includes("Your notification inbox and queued")
        )
      )
        body.push({
          __component: "content.rich-text",
          body: [
            heading("Notifications and mailing lists"),
            paragraph(
              "Your notification inbox and queued activity emails are deleted with your account. Local newsletter subscriptions linked to you or to your account email are removed. If an address has already been imported into a campaign mailing list, it must be removed there separately; contact info@libraries.global for help. Deleting an account does not erase the email messages already in your inbox."
            ),
          ],
        })
    }
    if (
      doc.slug === "badges" &&
      !body.some((c: any) => JSON.stringify(c).includes("Badges earned"))
    )
      body.push({
        __component: "content.rich-text",
        body: [
          heading("When you earn a badge"),
          paragraph(
            "A newly earned badge creates an update in your private notification inbox. Badge emails start off; turn on Badges earned in Profile → Settings → Notifications if you want them. Turning the email off does not remove the badge or the inbox update."
          ),
        ],
      })
    if (
      doc.slug === "how-review-works" &&
      !body.some((c: any) =>
        JSON.stringify(c).includes("reviewed submission also")
      )
    )
      body.push({
        __component: "content.rich-text",
        body: [
          heading("Your notification inbox"),
          paragraph(
            "A reviewed submission also creates a private inbox update, even if review emails are off. Review decisions and notes remain in My submissions. There is no reply thread yet. Approved library claims and role application decisions also send essential service emails."
          ),
        ],
      })
    if (doc.slug === "plans-and-pro") {
      for (const c of body)
        if (c.__component === "content.rich-text")
          for (const b of c.body)
            for (const t of b.children ?? [])
              if (t.text)
                t.text = t.text.replaceAll(
                  /A weekly digest[^.]*coming soon\./gi,
                  "An opt-in weekly digest of public changes to followed libraries is included in a free account."
                )
      if (
        !body.some((c: any) =>
          JSON.stringify(c).includes("Weekly emails on a free account")
        )
      )
        body.push({
          __component: "content.rich-text",
          body: [
            heading("Weekly emails on a free account"),
            paragraph(
              "Weekly digest covers public changes to libraries you follow. Weekly community report covers recorded community totals, new articles and your own progress. Both are included in a free account, require separate opt-ins, and stay quiet when there are no updates. Neither subscribes you to the newsletter. Immediate email alerts remain a planned Pro feature."
            ),
          ],
        })
    }
    if (apply) {
      await client.call("update_wiki-article", {
        documentId: doc.documentId,
        locale: "en",
        data: { title: doc.title, slug: doc.slug, body },
      })
      if (doc.status === "published" || doc.status === "modified")
        await client.call("publish_wiki-article", {
          documentId: doc.documentId,
          locale: "en",
        })
    }
    console.log(`${apply ? "Updated" : "Preview"} Knowledge: ${doc.slug}`)
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Content update failed"
  )
  process.exitCode = 1
})
