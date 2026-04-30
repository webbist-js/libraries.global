import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

const GUIDELINES = [
  {
    title: "Verifiable.",
    body: "Cite a source — institutional URL, official press release, your own institutional affiliation, or recent on-site evidence (a photo with EXIF helps).",
  },
  {
    title: "Translated, not transliterated.",
    body: "Use the institution's own preferred local name, then provide a translation — never the other way around.",
  },
  {
    title: "License every image.",
    body: "Public-domain, your own work, or CC-BY/CC-BY-SA. Photos lifted from search results are removed at review.",
  },
  {
    title: "Forgiving drafts.",
    body: "Save anything, anytime. The form only blocks on submit when required fields are missing — not while you write.",
  },
]

type RoleChipVariant = "faint" | "aurora" | "ok" | "violet" | "gold"

interface RoleRow {
  role: string
  badge: { label: string; variant: RoleChipVariant }
  actions: { label: string; variant: RoleChipVariant }[]
}

const ROLE_ROWS: RoleRow[] = [
  {
    role: "Reader",
    badge: { label: "no login required", variant: "faint" },
    actions: [{ label: "Browse", variant: "faint" }],
  },
  {
    role: "Contributor",
    badge: { label: "default for signed-in users", variant: "faint" },
    actions: [
      { label: "Add", variant: "aurora" },
      { label: "Edit", variant: "aurora" },
    ],
  },
  {
    role: "Verified librarian",
    badge: { label: "affiliation confirmed", variant: "faint" },
    actions: [{ label: "Fast-track review", variant: "ok" }],
  },
  {
    role: "Wiki editor",
    badge: { label: "invited or earned", variant: "faint" },
    actions: [{ label: "Project docs", variant: "violet" }],
  },
  {
    role: "Editorial board",
    badge: { label: "stewards · N members", variant: "faint" },
    actions: [
      { label: "Approve", variant: "gold" },
      { label: "Publish", variant: "gold" },
    ],
  },
]

function chipColor(variant: RoleChipVariant): {
  color: string
  background: string
} {
  switch (variant) {
    case "aurora":
      return { color: T.accent.aurora, background: "rgba(127,223,255,0.10)" }
    case "ok":
      return { color: T.accent.ok, background: "rgba(142,240,179,0.10)" }
    case "violet":
      return { color: T.accent.violet, background: "rgba(163,144,255,0.10)" }
    case "gold":
      return { color: T.accent.gold, background: "rgba(232,201,138,0.10)" }

    default:
      return { color: T.ink.faint, background: "rgba(255,255,255,0.06)" }
  }
}

export function ContributeGuidelinesSection() {
  return (
    <section
      style={{
        borderTop: `1px solid ${T.border.line}`,
        background: T.bg.space,
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-6 py-14 md:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          {/* Left — guidelines */}
          <div>
            <h2
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: T.ink.base,
                margin: "0 0 24px",
              }}
            >
              What we ask of every{" "}
              <em
                style={{
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: T.ink.dim,
                }}
              >
                contribution.
              </em>
            </h2>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              {GUIDELINES.map((g) => (
                <li
                  key={g.title}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}
                >
                  <Icon
                    icon="mdi:circle-outline"
                    style={{
                      color: T.accent.aurora,
                      flexShrink: 0,
                      marginTop: "3px",
                    }}
                    width={14}
                    height={14}
                  />
                  <p
                    style={{
                      fontSize: "14px",
                      color: T.ink.dim,
                      lineHeight: "1.65",
                      margin: 0,
                    }}
                  >
                    <strong style={{ color: T.ink.base, fontWeight: 600 }}>
                      {g.title}
                    </strong>{" "}
                    {g.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — roles table */}
          <div>
            <h2
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: T.ink.base,
                margin: "0 0 24px",
              }}
            >
              Roles &amp; what each{" "}
              <em
                style={{
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: T.ink.dim,
                }}
              >
                can do.
              </em>
            </h2>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {ROLE_ROWS.map((row) => {
                const badgeColors = chipColor(row.badge.variant)

                return (
                  <div
                    key={row.role}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 0",
                      borderBottom: `1px solid ${T.border.line}`,
                      gap: "12px",
                    }}
                  >
                    {/* Role name + badge */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: T.font.sans,
                          fontSize: "16px",
                          color: T.ink.base,
                        }}
                      >
                        {row.role}
                      </span>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: "4px",
                          fontFamily: T.font.mono,
                          fontSize: "10px",
                          letterSpacing: ".12em",
                          textTransform: "uppercase",
                          background: badgeColors.background,
                          color: badgeColors.color,
                        }}
                      >
                        {row.badge.label}
                      </span>
                    </div>

                    {/* Action chips */}
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      {row.actions.map((action) => {
                        const actionColors = chipColor(action.variant)

                        return (
                          <span
                            key={action.label}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "4px",
                              fontFamily: T.font.mono,
                              fontSize: "10px",
                              letterSpacing: ".12em",
                              textTransform: "uppercase",
                              background: actionColors.background,
                              color: actionColors.color,
                            }}
                          >
                            {action.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
