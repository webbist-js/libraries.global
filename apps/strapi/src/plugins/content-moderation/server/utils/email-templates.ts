/**
 * Plain emails for the moderation notifications (spec §6.3): short
 * sentences, the moderator's note quoted when there is one, one link, no
 * marketing. Every email has a plain-text body and a minimal HTML twin.
 */

type Email = { subject: string; text: string; html: string }

const SIGN_OFF = "Libraries Global"

/** Words for a submission type, as a contributor would say them. */
const TYPE_LABELS: Record<string, string> = {
  correction: "correction",
  new_library: "new library",
  library_claim: "library claim",
  library_edit: "library edit",
  wiki_edit: "Knowledge edit",
  blog_submission: "Journal submission",
  topic_suggestion: "topic suggestion",
  role_application: "role application",
  location_request: "location request",
}

const ROLE_LABELS: Record<string, string> = {
  wiki_editor: "Knowledge editor",
  journal_editor: "Journal editor",
  moderator: "Moderator",
}

const QUEUE_LABELS: Record<string, string> = {
  index: "Index",
  knowledge: "Knowledge",
  journal: "Journal",
}

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? "submission"
}

/** "Knowledge editor", or "Moderator of the Index queue" with a queue. */
export function roleLabel(role: string, queue?: string | null): string {
  const label = ROLE_LABELS[role] ?? role
  const queueLabel = queue ? QUEUE_LABELS[queue] : undefined

  return role === "moderator" && queueLabel
    ? `${label} of the ${queueLabel} queue`
    : label
}

export function languagesLabel(locales: string[]): string {
  return locales.length === 0 ? "all languages" : locales.join(", ")
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

/**
 * Builds the email from paragraphs: `note` becomes a quote under "Their
 * note:", and `link` the closing line.
 */
function compose(
  subject: string,
  parts: {
    greeting: string
    lines: string[]
    note?: string | null
    link: { label: string; url: string }
    footer?: string
  }
): Email {
  const note = parts.note?.trim() || null
  const text = [
    parts.greeting,
    ...parts.lines,
    ...(note
      ? [
          `Their note:\n${note
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n")}`,
        ]
      : []),
    `${parts.link.label}: ${parts.link.url}`,
    ...(parts.footer ? [parts.footer] : []),
    SIGN_OFF,
  ].join("\n\n")

  const p = (s: string) => `<p>${escapeHtml(s)}</p>`
  const html = [
    p(parts.greeting),
    ...parts.lines.map(p),
    ...(note
      ? [
          p("Their note:"),
          `<blockquote>${escapeHtml(note).replaceAll("\n", "<br>")}</blockquote>`,
        ]
      : []),
    `<p><a href="${escapeHtml(parts.link.url)}">${escapeHtml(parts.link.label)}</a></p>`,
    ...(parts.footer ? [p(parts.footer)] : []),
    p(SIGN_OFF),
  ].join("\n")

  return { subject, text, html }
}

const greeting = (name: string | null) =>
  name?.trim() ? `Hello ${name.trim()},` : "Hello,"

/** A submitter's submission was approved, rejected or needs information. */
export function decidedEmail(i: {
  name: string | null
  type: string
  status: string
  note: string | null
  url: string
}): Email {
  const label = typeLabel(i.type)
  const [subject, line] =
    i.status === "approved"
      ? [
          `Your ${label} was accepted`,
          `A moderator accepted your ${label}. Thank you.`,
        ]
      : i.status === "rejected"
        ? [
            `Your ${label} was not accepted`,
            `A moderator reviewed your ${label} and did not accept it.`,
          ]
        : [
            `A moderator has a question about your ${label}`,
            `A moderator needs more information before deciding on your ${label}.`,
          ]

  return compose(subject, {
    greeting: greeting(i.name),
    lines: [line],
    note: i.note,
    link: { label: "Your submissions", url: i.url },
    footer:
      "You can turn off these emails in your profile's notification settings.",
  })
}

/** A new submission that moderators are alerted to. */
export function moderatorAlertEmail(i: {
  type: string
  summary: string
  url: string
}): Email {
  return compose(`New ${typeLabel(i.type)} to review`, {
    greeting: "Hello,",
    lines: [i.summary],
    link: { label: "Review it", url: i.url },
  })
}

/** An applicant's Role Application was decided. */
export function applicationDecidedEmail(i: {
  name: string | null
  role: string
  /** Moderator applications: the queue applied for. */
  queue?: string | null
  locales: string[]
  status: string
  note: string | null
  url: string
}): Email {
  const role = roleLabel(i.role, i.queue)
  const languages = languagesLabel(i.locales)
  // Moderator applications are decided by the editorial board.
  const who = i.role === "moderator" ? "The editorial board" : "A moderator"
  const [subject, line] =
    i.status === "approved"
      ? [
          `You are now a ${role}`,
          `${who} approved your application. You are now a ${role} for ${languages}.`,
        ]
      : i.status === "rejected"
        ? [
            `Your application to be a ${role} was not accepted`,
            `${who} reviewed your application to be a ${role} for ${languages} and did not accept it.`,
          ]
        : [
            `${who} has a question about your application`,
            `${who} needs more information before deciding on your application to be a ${role} for ${languages}.`,
          ]

  return compose(subject, {
    greeting: greeting(i.name),
    lines: [line],
    note: i.note,
    link: { label: "Your submissions", url: i.url },
  })
}
