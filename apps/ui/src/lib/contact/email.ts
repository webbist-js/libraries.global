import "server-only"

import { emailTemplate, type EmailSection } from "@repo/shared-data"

import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants"
import type { AtlasFeedbackFeature, FeedbackTask } from "@/lib/contact/model"
import type { ContactSubmission } from "@/lib/contact/schema"
import { createEmailTransport } from "@/lib/email-transport"

const contactLabels = {
  report_issue: "Issue report",
  general_inquiry: "General inquiry",
  account_support: "Account support",
  library_correction: "Library correction",
  plans: "Plans and membership",
  partnership: "Partnership",
  privacy: "Privacy inquiry",
}
const topicLabels = {
  problem: "Problem",
  idea: "Suggestion",
  experience: "Experience",
  praise: "Something working well",
}
const taskLabels: Record<FeedbackTask, string> = {
  find_library: "Find a library",
  plan_visit: "Plan a visit",
  contribute: "Contribute information",
  manage_library: "Manage a library",
  compare_areas: "Compare areas",
  check_accessibility: "Check accessibility",
  export_data: "Export data",
  explore: "Explore the site",
  other: "Something else",
}
const atlasFeatureLabels: Record<AtlasFeedbackFeature, string> = {
  search: "Search",
  filters: "Filters",
  map_layers: "Map layers",
  library_details: "Library details",
  list_view: "List view",
  area_comparison: "Area comparison",
  accessibility: "Accessibility",
  exports: "Exports",
  other: "Something else",
}
const outcomeLabels = {
  yes: "Yes",
  partly: "Partly",
  no: "No",
  browsing: "Just browsing",
}
const emailPresentation = {
  atlas: {
    label: "Atlas feedback",
    eyebrow: "System notification · Atlas feedback",
    body: "A visitor shared feedback to help improve Atlas.",
  },
  feedback: {
    label: "Beta feedback",
    eyebrow: "System notification · Beta feedback",
    body: "A visitor shared feedback to help improve the beta.",
  },
  contact: {
    label: "Contact",
    eyebrow: "System notification · Contact request",
    body: "A visitor contacted Libraries Global. Reply to this email to respond to the address they supplied.",
  },
}

const dimensions = (size?: { width: number; height: number }) =>
  size ? `${size.width} × ${size.height}` : "Not available"

function pageContextSection(
  context: ContactSubmission["context"],
  userAgent: string
): EmailSection {
  return {
    kind: "note",
    title: "Page and device context",
    body: [
      `Page: ${context.page}`,
      context.referrer ? `Referred from: ${context.referrer}` : "",
      `Browser / OS: ${userAgent || "Not available"}`,
      `Viewport: ${dimensions(context.viewport)} CSS px`,
      `Screen: ${dimensions(context.screen)} CSS px`,
      `Pixel ratio: ${context.pixelRatio ?? "Not available"}`,
      `Site language: ${context.locale}`,
      `Browser language: ${context.language ?? "Not available"}`,
      `Timezone: ${context.timezone ?? "Not available"}`,
      `Pointer: ${context.pointer ?? "Not available"}`,
      `Reduced motion: ${context.reducedMotion === undefined ? "Not available" : context.reducedMotion ? "Yes" : "No"}`,
      `Time on page before opening: ${context.timeOnPageSeconds ?? "Not available"} seconds`,
    ]
      .filter(Boolean)
      .join("\n"),
  }
}

function feedbackSection(
  submission: Extract<ContactSubmission, { mode: "feedback" }>
): EmailSection {
  const atlas = submission.atlas
  const items: Extract<EmailSection, { kind: "metrics" }>["items"] = [
    {
      label: "Task",
      value:
        atlas && submission.task === "explore"
          ? "Explore Atlas"
          : taskLabels[submission.task],
      tone: "blue",
    },
    {
      label: "Completed their task",
      value: outcomeLabels[submission.outcome],
      tone: submission.outcome === "yes" ? "green" : "gold",
    },
  ]
  if (submission.ease)
    items.push({
      label: "Ease of use (1 = difficult, 5 = easy)",
      value: `${submission.ease}/5`,
      tone: "purple",
    })
  if (atlas)
    items.push({
      label: "Features used",
      value: atlas.features
        .map((feature) => atlasFeatureLabels[feature])
        .join(", "),
      tone: "blue",
    })
  if (atlas?.clarity)
    items.push({
      label: "Map and data clarity (1 = unclear, 5 = clear)",
      value: `${atlas.clarity}/5`,
      tone: "purple",
    })

  return {
    kind: "metrics",
    title: atlas ? "Atlas feedback" : "Product feedback",
    items,
  }
}

export function contactEmail(
  submission: ContactSubmission,
  userAgent: string,
  reference: string,
  receivedAt: Date
) {
  const feedback = submission.mode === "feedback"
  const atlas = feedback ? submission.atlas : undefined
  const category = feedback
    ? topicLabels[submission.topic]
    : contactLabels[submission.type]
  const context = submission.context
  const presentation =
    emailPresentation[atlas ? "atlas" : feedback ? "feedback" : "contact"]
  const title = `[${presentation.label}] ${category} · ${context.page}`
  const sections: EmailSection[] = [
    {
      kind: "note",
      title: "From",
      body: `${submission.name || "Anonymous visitor"}\n${submission.email || "No reply requested"}\nReference: ${reference}\nReceived: ${receivedAt.toISOString()}`,
    },
  ]
  if (feedback) sections.push(feedbackSection(submission))
  sections.push({
    kind: "note",
    title:
      feedback && atlas && submission.topic === "idea"
        ? "Things they’d like to see"
        : feedback
          ? "What they shared"
          : "Message",
    body: submission.message,
  })
  if (atlas?.wishlist)
    sections.push({
      kind: "note",
      title: "Things they’d like to see",
      body: atlas.wishlist,
    })
  if (submission.steps)
    sections.push({
      kind: "note",
      title: "Steps to reproduce",
      body: submission.steps,
    })
  if (submission.sourceSubject)
    sections.push({
      kind: "note",
      title: "Contact link context",
      body: submission.sourceSubject,
    })
  sections.push(pageContextSection(context, userAgent))

  return emailTemplate({
    title,
    eyebrow: presentation.eyebrow,
    body: presentation.body,
    sections,
    footer:
      "Sent to the Libraries Global admin inbox from the website contact form. Visitor content and device context are supplied for support.",
    postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
    siteUrl: process.env.APP_PUBLIC_URL,
  })
}

export async function sendContactNotification(
  submission: ContactSubmission,
  userAgent: string,
  reference: string
) {
  const transport = createEmailTransport()
  if (!transport) throw new Error("Contact email delivery is not configured")
  const result = await transport.sendMail({
    from: process.env.EMAIL_FROM ?? `"${SITE_NAME}" <noreply@libraries.global>`,
    to: CONTACT_EMAIL,
    replyTo: submission.email
      ? {
          address: submission.email,
          name: submission.name || "Website visitor",
        }
      : undefined,
    ...contactEmail(submission, userAgent, reference, new Date()),
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
      "X-Mailgun-Track": "no",
      "X-Mailgun-Track-Clicks": "no",
      "X-Mailgun-Track-Opens": "no",
    },
    disableFileAccess: true,
    disableUrlAccess: true,
  })
  if (result.rejected?.length)
    throw new Error("Contact email recipient was rejected")
}
