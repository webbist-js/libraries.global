/** Dependency-free, table-based HTML and plain text for every application email. */
export function escapeEmailHtml(value: string): string {
  return value.replaceAll(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  )
}
export type EmailTone = "purple" | "green" | "blue" | "gold"
export type EmailSection =
  | {
      kind: "metrics"
      title: string
      items: { value: string | number; label: string; tone?: EmailTone }[]
    }
  | {
      kind: "rows"
      title: string
      items: {
        title: string
        detail?: string
        eyebrow?: string
        url?: string
        action?: string
        tone?: EmailTone
      }[]
    }
  | {
      kind: "note"
      title?: string
      body: string
      url?: string
      action?: string
    }
export type EmailInput = {
  title: string
  body: string
  url?: string
  action?: string
  eyebrow?: string
  period?: string
  preview?: string
  code?: string
  codeLabel?: string
  sections?: EmailSection[]
  footer?: string
  unsubscribeUrl?: string
  preferencesUrl?: string
  postalAddress?: string
  siteUrl?: string
}
export type RenderedEmail = { subject: string; text: string; html: string }
const e = escapeEmailHtml
const ink = "#f1eee6",
  muted = "#c0bdca",
  line = "#45414f"
const tones: Record<EmailTone, { bg: string; fg: string }> = {
  purple: { bg: "#ece8f6", fg: "#51428c" },
  green: { bg: "#e6f0e5", fg: "#345e40" },
  blue: { bg: "#e2ecf4", fg: "#305578" },
  gold: { bg: "#f5f0d9", fg: "#705721" },
}
function safeUrl(value?: string) {
  if (!value || !/^https?:\/\//i.test(value) || /[\r\n]/.test(value)) return
  try {
    const url = new URL(value)

    return url.username || url.password ? undefined : value
  } catch {
    return
  }
}
const paragraph = (text: string) =>
  text
    .split(/\n\n+/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font:16px/1.65 Arial,sans-serif;color:${muted}">${e(p).replaceAll("\n", "<br>")}</p>`
    )
    .join("")
const heading = (text: string) =>
  `<h2 style="margin:28px 0 14px;font:700 12px/1.5 Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:${ink}">${e(text)}</h2>`
function link(url: string | undefined, label: string, color = "#b5a9ff") {
  const safe = safeUrl(url)

  return safe
    ? `<a href="${e(safe)}" style="color:${color};font-weight:600;text-decoration:underline">${e(label)}</a>`
    : e(label)
}
function sectionHtml(section: EmailSection) {
  if (section.kind === "note")
    return `<div style="margin:22px 0;padding:20px;border:1px solid ${line};border-radius:14px">${section.title ? `<h2 style="margin:0 0 10px;font:700 14px Arial,sans-serif;color:${ink}">${e(section.title)}</h2>` : ""}${paragraph(section.body)}${section.url ? link(section.url, section.action ?? "Read more") : ""}</div>`
  if (section.kind === "rows")
    return (
      heading(section.title) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${section.items
        .map((item) => {
          const tone = tones[item.tone ?? "blue"]

          return `<tr><td width="48" valign="top" style="padding:18px 12px 18px 0;border-top:1px solid ${line}"><div style="width:40px;height:40px;border-radius:20px;background:${tone.bg};color:${tone.fg};font:700 22px/40px Georgia,serif;text-align:center">${e(Array.from(item.title.trim())[0] ?? "L")}</div></td><td style="padding:18px 0;border-top:1px solid ${line}">${item.eyebrow ? `<p style="margin:0 0 5px;font:700 11px Arial,sans-serif;letter-spacing:.6px;color:${muted}">${e(item.eyebrow)}</p>` : ""}<h3 style="margin:0 0 5px;font:24px/1.25 Georgia,serif;color:${ink}">${e(item.title)}</h3>${item.detail ? `<p style="margin:0 0 10px;font:14px/1.5 Arial,sans-serif;color:${muted}">${e(item.detail)}</p>` : ""}${item.url ? `<p style="margin:8px 0 0;font:14px Arial,sans-serif">${link(item.url, item.action ?? "Read more")}</p>` : ""}</td></tr>`
        })
        .join("")}</table>`
    )
  const pairs: string[] = []
  for (let i = 0; i < section.items.length; i += 2) {
    const cells = section.items
      .slice(i, i + 2)
      .map((item) => {
        const tone = tones[item.tone ?? "purple"]

        return `<td width="50%" valign="top" style="padding:0 5px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${tone.bg}" style="padding:20px 16px;border-radius:14px;color:${tone.fg}"><p style="margin:0 0 6px;font:36px/1.1 Georgia,serif;color:#19172b">${e(String(item.value))}</p><p style="margin:0;font:14px/1.5 Arial,sans-serif">${e(item.label)}</p></td></tr></table></td>`
      })
      .join("")
    pairs.push(`<tr>${cells}</tr>`)
  }

  return (
    heading(section.title) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${pairs.join("")}</table>`
  )
}
function sectionText(section: EmailSection) {
  if (section.kind === "note")
    return [
      section.title,
      section.body,
      safeUrl(section.url)
        ? `${section.action ?? "Read more"}: ${section.url}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n")

  return (
    section.title +
    "\n" +
    section.items
      .map((item) =>
        "value" in item
          ? `• ${item.label}: ${item.value}`
          : [
              `• ${item.title}`,
              item.eyebrow,
              item.detail,
              safeUrl(item.url)
                ? `${item.action ?? "Read more"}: ${item.url}`
                : "",
            ]
              .filter(Boolean)
              .join("\n")
      )
      .join("\n\n")
  )
}
function emailFooter(
  input: Pick<
    EmailInput,
    "footer" | "unsubscribeUrl" | "preferencesUrl" | "postalAddress" | "siteUrl"
  >
) {
  const base = (safeUrl(input.siteUrl) ?? "https://libraries.global").replace(
    /\/$/,
    ""
  )
  const footer =
    input.footer ??
    "An independent, open-source project. Questions? Reply to this email."
  const preferences = safeUrl(input.preferencesUrl)
  const unsubscribe = safeUrl(input.unsubscribeUrl)

  return {
    text: [
      footer,
      preferences ? `Manage email preferences: ${preferences}` : "",
      unsubscribe ? `Unsubscribe: ${unsubscribe}` : "",
      `Privacy: ${base}/legal/privacy`,
      input.postalAddress ? `Libraries Global · ${input.postalAddress}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:28px 8px 16px;font:600 13px/1.9 Arial,sans-serif;color:${ink}">${[
      ["Find libraries", "/libraries"],
      ["Contribute", "/contribute"],
      ["Knowledge", "/knowledge"],
      ["Journal", "/journal"],
    ]
      .map(([label, href]) => link(base + href, label!, ink))
      .join(
        " &nbsp;·&nbsp; "
      )}</td></tr><tr><td style="padding:18px 8px;border-top:1px solid ${line};font:12px/1.8 Arial,sans-serif;color:${muted}">${e(footer)}<br>${[preferences ? link(preferences, "Manage email preferences") : "", unsubscribe ? link(unsubscribe, "Unsubscribe") : "", link(base + "/legal/privacy", "Privacy")].filter(Boolean).join(" &nbsp;|&nbsp; ")}${input.postalAddress ? `<br>Libraries Global · ${e(input.postalAddress)}` : ""}</td></tr></table>`,
  }
}

export function emailTemplate(input: EmailInput): RenderedEmail {
  const url = safeUrl(input.url)
  const footer = emailFooter(input)
  const displayUrl = url ? new URL(url).host + new URL(url).pathname : ""
  const sections = input.sections ?? []
  const codeBlock = input.code
    ? `<div style="margin:24px 0;padding:22px;background:#ece8f6;border-radius:14px;text-align:center;${input.code.length > 12 ? "font:700 16px/1.6 monospace;letter-spacing:0;word-break:break-all;overflow-wrap:anywhere" : "font:700 32px/1.3 monospace;letter-spacing:5px"};color:#19172b">${input.codeLabel ? `<p style="margin:0 0 10px;font:600 12px Arial,sans-serif">${e(input.codeLabel)}</p>` : ""}${e(input.code)}</div>`
    : ""

  return {
    subject: input.title.replaceAll(/[\r\n]/g, " "),
    text:
      [
        input.title,
        input.period,
        input.eyebrow,
        input.body,
        input.code
          ? `${input.codeLabel ?? "Confirmation code"}: ${input.code}`
          : "",
        ...sections.map(sectionText),
        url ? `${input.action ?? "Continue"}: ${url}` : "",
      ]
        .filter(Boolean)
        .join("\n\n") +
      "\n\n--\n" +
      footer.text,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${e(input.title)}</title></head><body bgcolor="#1c1a25" style="margin:0;padding:0;background:#1c1a25;color:${ink};font-family:Arial,sans-serif"><div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${e(input.preview ?? input.body.slice(0, 160))}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1c1a25"><tr><td align="center" style="padding:28px 12px"><!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0"><tr><td><![endif]--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;table-layout:fixed"><tr><td style="padding:4px 20px 26px"><p style="margin:0;font:30px/1.2 Georgia,serif;color:${ink}">Libraries <i>Global</i></p>${input.period ? `<p style="margin:12px 0 0;font:13px Arial,sans-serif;color:${muted}">${e(input.period)}</p>` : ""}</td></tr><tr><td bgcolor="#272430" style="padding:30px 24px;border:1px solid ${line};border-radius:22px;overflow-wrap:break-word;word-wrap:break-word">${input.eyebrow ? `<p style="margin:0 0 20px;font:700 11px/1.5 Arial,sans-serif;letter-spacing:1px;color:#cabaff;text-transform:uppercase">${e(input.eyebrow)}</p>` : ""}<h1 style="margin:0 0 20px;font:38px/1.15 Georgia,serif;color:${ink}">${e(input.title)}</h1>${paragraph(input.body)}${codeBlock}${sections.map(sectionHtml).join("")}${url ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr><td bgcolor="#4936cb" style="border-radius:28px;text-align:center;mso-padding-alt:16px 26px"><a href="${e(url)}" style="display:inline-block;padding:16px 26px;font:700 16px/1.4 Arial,sans-serif;color:#ffffff;text-decoration:none;border:1px solid #4936cb;border-radius:28px">${e(input.action ?? "Continue")} &rarr;</a></td></tr></table><p style="margin:18px 0 0;font:12px/1.6 Arial,sans-serif;color:${muted};word-break:break-all">Button not working? Open ${link(url, displayUrl.length > 80 ? displayUrl.slice(0, 77) + "…" : displayUrl)}</p>` : ""}</td></tr><tr><td><!-- email-footer-start -->${footer.html}<!-- email-footer-end --></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`,
  }
}
/** The worker adds fresh category controls at delivery, including to queued rendered emails. */
export function withEmailPreferences(
  message: RenderedEmail,
  input: Parameters<typeof emailFooter>[0]
): RenderedEmail {
  const footer = emailFooter(input)
  const startMarker = "<!-- email-footer-start -->"
  const endMarker = "<!-- email-footer-end -->"
  const start = message.html.indexOf(startMarker)
  const end =
    start === -1
      ? -1
      : message.html.indexOf(endMarker, start + startMarker.length)
  const replacement = `${startMarker}${footer.html}${endMarker}`

  return {
    ...message,
    text: `${message.text.split("\n\n--\n")[0]}\n\n--\n${footer.text}`,
    html:
      end >= 0
        ? message.html.slice(0, start) +
          replacement +
          message.html.slice(end + endMarker.length)
        : `${message.html}<div style="padding:16px;background:#1c1a25">${footer.html}</div>`,
  }
}
export function emailWeekLabel(start: string, end: string) {
  const date = (value: Date) =>
    value.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })

  return `${date(new Date(start))} – ${date(new Date(new Date(end).getTime() - 86400000))} (UTC)`
}
export type DigestEmailData = {
  start: string
  end: string
  libraries: { name: string; href?: string }[]
}
export type CommunityEmailData = {
  start: string
  end: string
  week: {
    newLibraries: number
    updatedLibraries: number
    edits: number
    accepted: number
    knowledge: number
    journal: number
    articles: { title: string; href: string; kind: string }[]
  }
  personal: { accepted: number; points: number; awaiting: number }
}
export function digestEmail(
  data: DigestEmailData,
  options: Pick<
    EmailInput,
    | "url"
    | "footer"
    | "unsubscribeUrl"
    | "preferencesUrl"
    | "postalAddress"
    | "siteUrl"
    | "eyebrow"
  > = {}
) {
  const base = (safeUrl(options.siteUrl) ?? "https://libraries.global").replace(
    /\/$/,
    ""
  )

  return emailTemplate({
    ...options,
    title: "Your weekly library digest",
    period: emailWeekLabel(data.start, data.end),
    eyebrow: options.eyebrow ?? "From your following list",
    body: "A short look at the libraries you follow that had public updates last week.",
    action: "Open your following list",
    sections: [
      {
        kind: "rows",
        title: `${data.libraries.length} ${data.libraries.length === 1 ? "library you follow was" : "libraries you follow were"} updated`,
        items: data.libraries.map((library, i) => ({
          title: library.name,
          detail: "Public information updated this week",
          ...(library.href?.startsWith("/") && !library.href.startsWith("//")
            ? { url: base + library.href, action: "View library" }
            : {}),
          tone: i % 2 ? "green" : "blue",
        })),
      },
    ],
    footer:
      options.footer ??
      "You’re getting this because the weekly digest is on in your notification settings.",
  })
}
export function communityReportEmail(
  data: CommunityEmailData,
  options: Parameters<typeof digestEmail>[1] = {}
) {
  const { week, personal } = data
  const base = (safeUrl(options.siteUrl) ?? "https://libraries.global").replace(
    /\/$/,
    ""
  )
  const sections: EmailSection[] = [
    {
      kind: "metrics",
      title: "Your progress",
      items: [
        { value: personal.accepted, label: "Contributions accepted" },
        {
          value: `${personal.points > 0 ? "+" : ""}${personal.points}`,
          label: "Points earned (net)",
        },
      ],
    },
    ...(personal.awaiting
      ? [
          {
            kind: "note" as const,
            body: `${personal.awaiting} ${personal.awaiting === 1 ? "submission is" : "submissions are"} currently awaiting review or more information.`,
            url: base + "/contribute/submissions",
            action: "Check your submissions",
          },
        ]
      : []),
    {
      kind: "metrics",
      title: "Across the community",
      items: [
        {
          value: week.newLibraries,
          label: "Newly published libraries",
          tone: "green",
        },
        {
          value: week.updatedLibraries,
          label: `Other libraries updated · ${week.edits} saved edit batches`,
          tone: "blue",
        },
        {
          value: week.accepted,
          label: "Content contributions accepted",
          tone: "purple",
        },
        {
          value: week.knowledge + week.journal,
          label: `New articles · ${week.knowledge} Knowledge, ${week.journal} Journal`,
          tone: "gold",
        },
      ],
    },
    ...(week.articles.length
      ? [
          {
            kind: "rows" as const,
            title: "New reading",
            items: week.articles.map((article) => ({
              title: article.title,
              eyebrow: article.kind === "wiki" ? "KNOWLEDGE" : "JOURNAL",
              url:
                article.href.startsWith("/") && !article.href.startsWith("//")
                  ? base + article.href
                  : undefined,
              action: "Read article",
              tone: "gold" as const,
            })),
          },
        ]
      : []),
    {
      kind: "note",
      title: "About these numbers",
      body: "Counts come from recorded activity and exclude imported library batches. An edit batch is one saved change, not individual fields. Review notes stay in My submissions.",
      url: base + "/contribute/submissions",
      action: "My submissions",
    },
  ]

  return emailTemplate({
    ...options,
    title: "Your weekly community report",
    period: emailWeekLabel(data.start, data.end),
    eyebrow: options.eyebrow ?? "The week in Libraries Global",
    body: "What changed across the project, and the part you played.",
    sections,
    url: options.url ?? base + "/profile",
    action: "See your full activity",
    footer:
      options.footer ??
      "You’re getting this because weekly community reports are on in your notification settings.",
  })
}

/** Strapi owns the reset token. This supplies its configured interpolation template. */
export function adminResetEmailTemplate(
  options: Pick<EmailInput, "siteUrl" | "postalAddress"> = {}
) {
  const sentinel = "https://libraries.global/__cms_reset_link__"
  const email = emailTemplate({
    ...options,
    title: "Reset your Libraries Global admin password",
    eyebrow: "Content administration",
    body: "Use the link below to choose a new administrator password. It expires in one hour. If you did not request this, you can ignore this email.",
    url: sentinel,
    action: "Reset admin password",
  })

  return {
    ...email,
    text: email.text.replaceAll(sentinel, "<%= url %>"),
    html: email.html
      .replaceAll(sentinel, "<%- url %>")
      .replaceAll("libraries.global/__cms_reset_link__", "your reset link"),
  }
}
