export type InternalEvent = {
  eventKey: string
  kind: string
  title: string
  detail: string
  href?: string
  actorId?: string
  eventAt: string
}

export function notificationConfig() {
  if (process.env.INTERNAL_NOTIFICATIONS_ENABLED !== "true") return null
  const since = process.env.INTERNAL_NOTIFICATIONS_SINCE ?? ""
  if (!Number.isFinite(Date.parse(since)))
    throw new Error("Internal notification activation date is required")
  const dryRun = process.env.INTERNAL_NOTIFICATIONS_DRY_RUN === "true"
  const webhook = process.env.SLACK_INTERNAL_WEBHOOK_URL ?? ""
  if (!dryRun && !validSlackWebhook(webhook))
    throw new Error("Invalid internal Slack webhook configuration")

  return {
    since: new Date(since).toISOString(),
    dryRun,
    webhook,
    feedbackWebhook: process.env.SLACK_FEEDBACK_WEBHOOK_URL ?? "",
    environment:
      process.env.APP_ENV === "production" ? "production beta" : "development",
  }
}

/** Validate destinations independently so feedback configuration cannot pause activity. */
export function validSlackWebhook(value: string): boolean {
  try {
    const url = new URL(value)

    return (
      url.origin === "https://hooks.slack.com" &&
      /^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(
        url.pathname
      ) &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

export function maskEmail(value: unknown): string {
  return typeof value === "string" && value.includes("@")
    ? "Email provided"
    : "Email withheld"
}

/** Plain text blocks prevent user-controlled Slack markup, mentions and links. */
const clean = (s: string, max: number, preserveLines = false) =>
  Array.from(
    s
      .replaceAll(/\p{Cc}/gu, (character) =>
        preserveLines && character === "\n" ? "\n" : " "
      )
      .slice(0, max),
    (character) => {
      const point = character.codePointAt(0)!

      return point >= 0xd800 && point <= 0xdfff ? "\uFFFD" : character
    }
  ).join("")

export function slackMessage(event: InternalEvent, environment: string) {
  const title = clean(event.title, 150)
  const detail = clean(
    event.detail,
    event.kind === "product_feedback" ? 12000 : 1000,
    event.kind === "product_feedback"
  )
  const context = `${environment} · ${new Date(event.eventAt).toISOString()}`
  const sections = []
  // Slack plain-text sections are limited to 3,000 characters. Preserve full
  // feedback, reproduction steps and Atlas answers without enabling markup.
  let remaining = detail
  while (remaining) {
    let end = Math.min(remaining.length, 2900)
    if (end < remaining.length && remaining.codePointAt(end - 1)! > 0xffff)
      end--
    sections.push({
      type: "section",
      text: { type: "plain_text", text: remaining.slice(0, end), emoji: false },
    })
    remaining = remaining.slice(end)
  }
  const blocks: Record<string, unknown>[] = [
    { type: "header", text: { type: "plain_text", text: title, emoji: false } },
    ...sections,
    {
      type: "context",
      elements: [{ type: "plain_text", text: context, emoji: false }],
    },
  ]
  if (event.href) {
    const base = new URL(
      process.env.APP_PUBLIC_URL || "https://libraries.global"
    )
    const url = new URL(event.href, base)
    if (url.origin === base.origin && !url.username && !url.password)
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open in Libraries Global" },
            url: url.href,
          },
        ],
      })
  }

  const fallback = `${title}: ${detail}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

  return {
    text: fallback,
    blocks,
    unfurl_links: false,
    unfurl_media: false,
    mrkdwn: false,
  }
}

export class SlackDeliveryError extends Error {
  constructor(
    public code: string,
    public retryAfter?: number,
    public permanent = false
  ) {
    super(code)
  }
}

export async function postToSlack(
  webhook: string,
  message: ReturnType<typeof slackMessage>
): Promise<void> {
  let response: Response
  try {
    response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    })
  } catch {
    // Fetch errors can contain the credential-bearing URL. Never retain the error.
    throw new SlackDeliveryError("slack_unreachable")
  }
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after"))
    throw new SlackDeliveryError(
      "slack_rate_limited",
      Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 86400) : 60
    )
  }
  if (!response.ok)
    throw new SlackDeliveryError(
      `slack_http_${response.status}`,
      undefined,
      response.status >= 400 && response.status < 500
    )
  if ((await response.text()).trim() !== "ok")
    throw new SlackDeliveryError("slack_invalid_response")
}
