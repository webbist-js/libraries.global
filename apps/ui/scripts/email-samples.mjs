import { createRequire } from "node:module"

import {
  adminResetEmailTemplate,
  communityReportEmail,
  digestEmail,
  emailTemplate,
  withEmailPreferences,
} from "@repo/shared-data"

const { template } = createRequire(import.meta.url)("lodash")
import {
  applicationDecidedEmail,
  claimApprovedEmail,
  decidedEmail,
  driveThanksEmail,
  moderatorAlertEmail,
} from "../../strapi/src/plugins/content-moderation/server/utils/email-templates.ts"
import { billingNotice } from "../../strapi/src/utils/billing-notice.ts"

/** Inert previews: no tokens, enrollments, queue records or real moderation changes. */
export function emailSamples() {
  const base = "https://libraries.global"
  const options = {
    siteUrl: base,
    postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
    eyebrow: "Delivery sample",
  }
  const activity = {
    ...options,
    preferencesUrl: base + "/profile/settings#notifications",
    unsubscribeUrl: base + "/profile/settings#notifications",
    footer:
      "Delivery sample only. You have not been subscribed. The preference links open Settings; they do not unsubscribe an account.",
  }
  const simple = (id, title, body, href, action, optional = false) => ({
    id,
    ...emailTemplate({
      ...(optional ? activity : options),
      title,
      body,
      url: href ? base + href : undefined,
      action,
    }),
  })
  const paid = {
    mode: "sandbox",
    plan: "pro",
    status: "active",
    interval: "month",
    currency: "gbp",
    unitAmount: 500,
    memberSince: "2026-10-12T12:00:00Z",
    periodEnd: "2026-11-12T12:00:00Z",
    paidThrough: "2026-11-12T12:00:00Z",
    pastDueSince: null,
    cancelAtPeriodEnd: false,
    revoked: false,
  }
  const billingSamples = [
    ["billing-ready", paid, null],
    [
      "billing-supporter-ready",
      { ...paid, plan: "supporter", unitAmount: 300 },
      null,
    ],
    [
      "billing-upgraded-to-pro",
      paid,
      { ...paid, plan: "supporter", unitAmount: 300 },
    ],
    [
      "billing-downgraded-to-supporter",
      { ...paid, plan: "supporter", unitAmount: 300 },
      paid,
    ],
    [
      "billing-change-scheduled",
      {
        ...paid,
        pendingChange: {
          plan: "supporter",
          interval: "month",
          effectiveAt: paid.paidThrough,
        },
      },
      paid,
    ],
    [
      "billing-change-undone",
      paid,
      {
        ...paid,
        pendingChange: {
          plan: "supporter",
          interval: "month",
          effectiveAt: paid.paidThrough,
        },
      },
    ],
    ["billing-canceled", { ...paid, cancelAtPeriodEnd: true }, paid],
    ["billing-resumed", paid, { ...paid, cancelAtPeriodEnd: true }],
    ["billing-recovered", paid, { ...paid, status: "past_due" }],
    ["billing-ended", { ...paid, graceExpired: true }, paid],
    ["billing-changed", { ...paid, interval: "year" }, paid],
  ].map(([id, next, previous]) => {
    const notice = billingNotice(
      next,
      previous,
      new Date("2026-10-12T12:00:00Z")
    )

    return simple(
      id,
      notice.title,
      notice.body,
      "/profile/settings#membership",
      "Manage membership"
    )
  })
  const samples = [
    ...billingSamples,
    simple(
      "verification",
      "Confirm your Libraries Global email address",
      "Confirm your email address to finish creating your Libraries Global account. The link works for one hour. If you did not sign up, you can ignore this email.",
      "/auth/signin",
      "Confirm email"
    ),
    simple(
      "magic-link",
      "Your Libraries Global sign-in link",
      "Sign in to Libraries Global. This link works once, within 5 minutes. If you did not request it, you can ignore this email.",
      "/auth/signin",
      "Sign in"
    ),
    simple(
      "password-reset",
      "Reset your Libraries Global password",
      "Choose a new Libraries Global password. The link works once, for one hour. If you did not ask for it, your password stays the same.",
      "/auth/signin",
      "Reset password"
    ),
    {
      id: "live-code",
      ...emailTemplate({
        ...options,
        title: "Confirm it is you — Libraries Global Live",
        body: "This confirmation code normally works once, within 10 minutes. This example code cannot be used to sign in.",
        code: "000000",
      }),
    },
    simple(
      "live-console",
      "Your Libraries Global Live link",
      "Open your library’s live console to update its mobile service. You’ll need to sign in with your authorized staff account.",
      "/profile",
      "Open live console"
    ),
    simple(
      "admin-invitation",
      "Your Libraries Global admin invitation",
      "You have been invited to the Libraries Global content administration team. Set up your administrator account using the link below.",
      "/profile",
      "Accept admin invitation"
    ),
    {
      id: "admin-reset",
      ...Object.fromEntries(
        Object.entries(adminResetEmailTemplate(options)).map(([key, value]) => [
          key,
          template(value)({ url: base + "/profile" }),
        ])
      ),
    },
    simple(
      "team-invitation",
      "You’ve been invited to a Libraries Global team",
      "The Sample Library team has invited you to join. Review the invitation and sign in to accept it.",
      "/profile",
      "View invitation"
    ),
    ...["approved", "rejected", "needs_info"].map((status) => ({
      id: "review-" + status,
      ...withEmailPreferences(
        decidedEmail({
          name: "Alex",
          type: "correction",
          status,
          note:
            status === "approved"
              ? "Thank you for checking the opening hours against the library’s website."
              : status === "rejected"
                ? "The source describes a temporary closure. Please submit that as a dated notice."
                : "Could you add a link to the library’s published opening hours?",
          url: base + "/contribute/submissions",
        }),
        activity
      ),
    })),
    ...["approved", "rejected", "needs_info"].map((status) => ({
      id: "role-" + status,
      ...applicationDecidedEmail({
        name: "Alex",
        role: "wiki_editor",
        locales: ["en"],
        status,
        note:
          status === "approved"
            ? "Welcome. The Knowledge guide explains the editing workflow."
            : "Please tell us a little more about the articles you’d like to help with.",
        url: base + "/contribute/submissions",
      }),
    })),
    {
      id: "claim-approved",
      ...claimApprovedEmail({
        name: "Alex",
        libraryName: "Sample Central Library",
        note: "Your affiliation has been verified.",
        url: base + "/profile",
      }),
    },
    {
      id: "moderator-alert",
      ...moderatorAlertEmail({
        type: "event_feed",
        summary:
          "A staff member submitted a calendar feed for Sample Central Library. Check ownership and the feed before approval.",
        url: base + "/contribute/moderation",
      }),
    },
    simple(
      "staff-access-report",
      "Library staff access needs review",
      "A staff member reported an access problem at Sample Central Library. Review the claim in the moderation queue.",
      "/contribute/moderation",
      "Review access"
    ),
    simple(
      "staff-joined",
      "A new staff member joined your library",
      "A verified staff claim was approved for Sample Central Library. Review staff membership and permissions in the Staff area.",
      "/profile",
      "View staff area"
    ),
    simple(
      "staff-removed",
      "Your library staff access changed",
      "Your staff access at Sample Central Library has ended. Your contributor account is still available.",
      "/profile",
      "View your profile"
    ),
    simple(
      "staff-permissions",
      "Your staff permissions changed",
      "Your staff level or permission to go live at Sample Central Library has changed. Check your current access in the Staff area.",
      "/profile",
      "View staff area"
    ),
    simple(
      "role-expiry",
      "Your temporary project role has expired",
      "Your temporary Knowledge editor grant has reached its end date. Other active grants still apply.",
      "/profile",
      "View your profile"
    ),
    simple(
      "feed-update",
      "Your library’s event feed was paused",
      "The events feed for Sample Central Library could not be fetched after repeated attempts. Staff can check the source and resume it.",
      "/profile",
      "View staff area"
    ),
    {
      id: "drive-closed",
      ...withEmailPreferences(
        driveThanksEmail({
          name: "Alex",
          title: "Opening hours week",
          url: base + "/community",
          goalMet: true,
          done: 80,
          total: 80,
          unitPlural: "tasks",
          closedGaps: 80,
          helpers: 14,
          yours: 3,
          bonus: true,
        }),
        activity
      ),
    },
    simple(
      "new-follower",
      "A new contributor started following you",
      "Sample Contributor is now following your public contributions on Libraries Global.",
      "/profile",
      "View profile",
      true
    ),
    simple(
      "recognition",
      "You earned Researcher",
      "You backed three accepted changes with cited sources. Thank you for making the index more reliable.",
      "/profile",
      "See recognition",
      true
    ),
    {
      id: "weekly-digest",
      ...digestEmail(
        {
          start: "2026-10-05T00:00:00Z",
          end: "2026-10-12T00:00:00Z",
          libraries: [
            { name: "Sample Central Library", href: "/libraries" },
            { name: "Sample Riverside Library", href: "/libraries" },
          ],
        },
        { ...activity, url: base + "/profile" }
      ),
    },
    {
      id: "weekly-community",
      ...communityReportEmail(
        {
          start: "2026-10-05T00:00:00Z",
          end: "2026-10-12T00:00:00Z",
          personal: { accepted: 3, points: 45, awaiting: 1 },
          week: {
            newLibraries: 12,
            updatedLibraries: 37,
            edits: 51,
            accepted: 28,
            knowledge: 2,
            journal: 1,
            articles: [
              { title: "How review works", kind: "wiki", href: "/knowledge" },
              {
                title: "Inside a community library",
                kind: "blog",
                href: "/journal",
              },
            ],
          },
        },
        activity
      ),
    },
    simple(
      "project-notice",
      "A note from the project stewards",
      "Our next maintenance window is planned for Sunday. Any changes to service availability will be posted on the site.",
      "/profile/notifications",
      "Read the notice",
      true
    ),
    simple(
      "product-update",
      "A new way to explore libraries",
      "An example feature announcement for readers who have explicitly opted into product updates.",
      "/libraries",
      "Explore libraries",
      true
    ),
    simple(
      "essential-notice",
      "An important account notice",
      "An example essential service notice about account access. Essential notices are separate from optional activity and marketing emails.",
      "/profile",
      "Read account notice"
    ),
    simple(
      "newsletter-confirmation",
      "Confirm your newsletter subscription",
      "Confirm that you want to receive Libraries Global news and Journal articles, at most monthly. The live confirmation link expires in seven days. If you did not request it, you can ignore this email.",
      "/profile/settings#notifications",
      "Confirm subscription",
      true
    ),
    {
      id: "monthly-newsletter",
      ...emailTemplate({
        ...activity,
        title: "The Libraries Global dispatch",
        period: "October 2026 · monthly newsletter",
        body: "A few things to read, explore and help improve this month.",
        sections: [
          {
            kind: "rows",
            title: "From the Journal",
            items: [
              {
                title: "Inside a community library",
                detail:
                  "An example story about the people who keep a local library open.",
                eyebrow: "JOURNAL",
                url: base + "/journal",
                action: "Read the Journal",
                tone: "gold",
              },
            ],
          },
          {
            kind: "note",
            title: "Help keep the index useful",
            body: "A checked source and a small correction can make someone’s library visit easier.",
            url: base + "/contribute",
            action: "Find a way to contribute",
          },
        ],
        url: base + "/libraries",
        action: "Explore the index",
      }),
    },
  ]

  return samples.map((sample) => ({
    ...sample,
    subject: `[Delivery sample: ${sample.id}] ${sample.subject}`,
    text:
      "DELIVERY SAMPLE. All names and counts are fictional. No account or subscription has been changed. Action links open ordinary site pages; credentials and unsubscribe actions are inactive.\n\n" +
      sample.text,
    html: sample.html.replace(
      "<h1 ",
      '<p style="margin:0 0 18px;padding:12px;background:#f5f0d9;border-radius:10px;color:#705721;font:12px/1.6 Arial,sans-serif">DELIVERY SAMPLE · Fictional content. No account or subscription changes. Action links are demonstrations.</p><h1 '
    ),
  }))
}
