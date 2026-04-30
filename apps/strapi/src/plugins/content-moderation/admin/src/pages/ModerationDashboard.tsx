import { Box, Button, Flex, Tabs, Typography } from "@strapi/design-system"
import { useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useMemo, useState } from "react"

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function IconX() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function IconInfo() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.2s",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
function IconLoader() {
  return (
    <span
      style={{ display: "inline-block", animation: "spin 1s linear infinite" }}
    >
      ⟳
    </span>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Submission = {
  documentId: string
  submissionType: string
  status: string
  targetEntityType?: string
  targetSlug?: string
  targetDocumentId?: string
  fields?: Record<string, unknown>
  note?: string
  reviewNote?: string
  submittedByEmail: string
  submittedByName?: string
  submittedByUserId: string
  reviewedAt?: string
  createdAt: string
  editSummary?: string
  evidenceType?: string
  evidenceUrl?: string
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { id: "pending", label: "Pending" },
  { id: "needs_info", label: "Needs Info" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
]

const TYPE_LABELS: Record<string, string> = {
  correction: "Correction",
  new_library: "New Library",
  library_edit: "Library Edit",
  library_claim: "Library Claim",
  wiki_edit: "Wiki Edit",
  blog_submission: "Blog",
  topic_suggestion: "Topic",
}

// Strapi DS badge colors: neutral, primary, success, warning, danger, secondary
const TYPE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  new_library: { bg: "#eaf5ff", text: "#0c75af", border: "#b8dff8" },
  library_edit: { bg: "#f0f0ff", text: "#4945ff", border: "#c4c4ff" },
  library_claim: { bg: "#fff3e0", text: "#d97706", border: "#fcd34d" },
  correction: { bg: "#ffeaea", text: "#d02b20", border: "#f5c0be" },
  wiki_edit: { bg: "#eafbf2", text: "#1b7c3a", border: "#a5dfc0" },
  blog_submission: { bg: "#f6ecfc", text: "#7b2d8b", border: "#dbb8eb" },
  topic_suggestion: { bg: "#f0f8ee", text: "#2d6a2a", border: "#b3d9b0" },
}

// ── Field grouping for FieldsPanel ────────────────────────────────────────────

const FIELD_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: "Identity",
    keys: [
      "name",
      "shortName",
      "officialName",
      "libraryType",
      "operatorType",
      "operationalStatus",
      "closureReason",
      "summary",
    ],
  },
  {
    label: "Location",
    keys: [
      "streetAddress",
      "district",
      "city",
      "postalCode",
      "country",
      "lat",
      "lng",
    ],
  },
  {
    label: "Contact & Web",
    keys: [
      "website",
      "email",
      "phone",
      "catalogueUrl",
      "planVisitUrl",
      "bookingUrl",
      "membershipUrl",
      "virtualTourUrl",
      "iiifEndpoint",
    ],
  },
  {
    label: "Visit",
    keys: [
      "admissionInfo",
      "transitInfo",
      "languagesServed",
      "accessibilityNotes",
    ],
  },
  {
    label: "Collections",
    keys: [
      "collectionSize",
      "collectionTypes",
      "specialCollections",
      "classificationSystem",
    ],
  },
  {
    label: "Building & History",
    keys: [
      "foundedYear",
      "openedYear",
      "closedYear",
      "architect",
      "architecturalStyle",
      "buildingInfo",
    ],
  },
  {
    label: "Media",
    keys: ["imageUrl", "imageNote", "imageCredit"],
  },
]

function renderValue(v: unknown): { text: string; isUrl: boolean } {
  if (v === null || v === undefined || v === "")
    return { text: "—", isUrl: false }
  if (Array.isArray(v)) {
    if (v.length === 0) return { text: "—", isUrl: false }

    return { text: v.join(", "), isUrl: false }
  }
  if (typeof v === "object") return { text: JSON.stringify(v), isUrl: false }
  const s = String(v)
  const isUrl = s.startsWith("http://") || s.startsWith("https://")

  return { text: s, isUrl }
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#666687",
  marginBottom: "8px",
  paddingBottom: "6px",
  borderBottom: "1px solid #f0f0ff",
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#8e8ea9",
  fontWeight: 500,
  marginBottom: "2px",
  textTransform: "capitalize",
}

const fieldValueStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#32324d",
  fontWeight: 500,
  wordBreak: "break-word",
}

const fieldValueEmptyStyle: React.CSSProperties = {
  ...fieldValueStyle,
  color: "#c0c0cf",
  fontWeight: 400,
}

// ── TypeBadge ─────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const colors = TYPE_COLORS[type] ?? {
    bg: "#f0f0ff",
    text: "#4945ff",
    border: "#c4c4ff",
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#fff3e0", text: "#d97706" },
    needs_info: { bg: "#eaf5ff", text: "#0c75af" },
    approved: { bg: "#eafbf2", text: "#1b7c3a" },
    rejected: { bg: "#ffeaea", text: "#d02b20" },
    draft: { bg: "#f0f0ff", text: "#8e8ea9" },
  }
  const colors = map[status] ?? { bg: "#f0f0ff", text: "#4945ff" }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        background: colors.bg,
        color: colors.text,
      }}
    >
      {status.replace("_", " ")}
    </span>
  )
}

// ── Submitter avatar ──────────────────────────────────────────────────────────

function Avatar({ name, email }: { name?: string; email: string }) {
  const initials = name
    ? name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : email.slice(0, 2).toUpperCase()

  return (
    <div
      style={{
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        background: "linear-gradient(135deg, #4945ff, #7b72ff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "11px",
        fontWeight: 700,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

// ── InlineNoteInput ───────────────────────────────────────────────────────────

function InlineNoteInput({
  label,
  placeholder,
  onConfirm,
  onCancel,
  loading,
}: {
  label: string
  placeholder: string
  onConfirm: (note: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [value, setValue] = useState("")

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "12px 14px",
        background: "#f6f6f9",
        borderRadius: "8px",
        border: "1px solid #dcdce4",
      }}
    >
      <label style={{ ...sectionHeaderStyle, display: "block" }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={3}
        autoFocus
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: "6px",
          border: "1px solid #dcdce4",
          fontSize: "13px",
          fontFamily: "inherit",
          color: "#32324d",
          background: "#fff",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      <Flex gap={2} marginTop={2}>
        <Button
          size="S"
          variant="default"
          disabled={loading}
          onClick={() => onConfirm(value)}
        >
          Confirm
        </Button>
        <Button size="S" variant="ghost" disabled={loading} onClick={onCancel}>
          Cancel
        </Button>
      </Flex>
    </div>
  )
}

// ── LibraryClaimPanel ─────────────────────────────────────────────────────────

function LibraryClaimPanel({ sub }: { sub: Submission }) {
  const fields = sub.fields ?? {}
  const domainMatch =
    fields.userEmailDomain &&
    fields.libraryWebsiteDomain &&
    fields.userEmailDomain === fields.libraryWebsiteDomain

  const allRows = [
    { label: "Library", value: String(fields.name ?? sub.targetSlug ?? "") },
    { label: "Entity Ref", value: String(fields.entityRef ?? "") },
    { label: "Role", value: String(fields.role ?? "") },
    { label: "Department", value: String(fields.department ?? "") },
    { label: "Submitter email", value: sub.submittedByEmail },
    {
      label: "Verification method",
      value: String(fields.verificationMethod ?? ""),
    },
    ...(fields.userEmailDomain
      ? [{ label: "User email domain", value: String(fields.userEmailDomain) }]
      : []),
    ...(fields.libraryWebsiteDomain
      ? [
          {
            label: "Library web domain",
            value: String(fields.libraryWebsiteDomain),
          },
        ]
      : []),
  ]
  // Only show rows that have a real value
  const rows = allRows.filter(({ value }) => value && value !== "—")

  return (
    <div style={{ marginTop: "16px" }}>
      <p style={sectionHeaderStyle}>Claim details</p>

      {/* Domain match banner */}
      {fields.userEmailDomain && fields.libraryWebsiteDomain && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "6px",
            background: domainMatch ? "#eafbf2" : "#fff3e0",
            border: `1px solid ${domainMatch ? "#a5dfc0" : "#fcd34d"}`,
            marginBottom: "12px",
            fontSize: "13px",
            fontWeight: 600,
            color: domainMatch ? "#1b7c3a" : "#d97706",
          }}
        >
          {domainMatch
            ? "✓ Domain match — auto-verification eligible"
            : "⚠ Domain mismatch — manual review required"}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 24px",
        }}
      >
        {rows.map(({ label, value }) => (
          <div
            key={label}
            style={{ padding: "10px 0", borderBottom: "1px solid #f0f0ff" }}
          >
            <div style={fieldLabelStyle}>{label}</div>
            <div style={fieldValueStyle}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── FieldsPanel ───────────────────────────────────────────────────────────────

function FieldsPanel({ sub }: { sub: Submission }) {
  const fields = sub.fields ?? {}
  if (Object.keys(fields).length === 0) return null

  const allUsedKeys = new Set(FIELD_GROUPS.flatMap((g) => g.keys))
  const ungrouped = Object.entries(fields).filter(
    ([k]) => !allUsedKeys.has(k) && k !== "openingTimes"
  )

  return (
    <div
      style={{
        marginTop: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {FIELD_GROUPS.map((group) => {
        const entries = group.keys
          .map((k) => ({ key: k, val: fields[k] }))
          .filter(({ val }) => val !== undefined && val !== null && val !== "")
        if (entries.length === 0) return null

        return (
          <div key={group.label}>
            <p style={sectionHeaderStyle}>{group.label}</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px 20px",
              }}
            >
              {entries.map(({ key, val }) => {
                const { text, isUrl } = renderValue(val)
                const isEmpty = text === "—"

                return (
                  <div
                    key={key}
                    style={{
                      padding: "6px 0",
                      borderBottom: "1px solid #f6f6f9",
                    }}
                  >
                    <div style={fieldLabelStyle}>
                      {key.replaceAll(/([A-Z])/g, " $1").toLowerCase()}
                    </div>
                    <div
                      style={isEmpty ? fieldValueEmptyStyle : fieldValueStyle}
                    >
                      {isUrl ? (
                        <a
                          href={text}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#4945ff",
                            fontSize: "13px",
                            wordBreak: "break-all",
                          }}
                        >
                          {text.length > 50 ? text.slice(0, 50) + "…" : text}
                        </a>
                      ) : (
                        text
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Ungrouped fields */}
      {ungrouped.length > 0 && (
        <div>
          <p style={sectionHeaderStyle}>Other</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px 20px",
            }}
          >
            {ungrouped.map(([k, v]) => {
              const { text, isUrl } = renderValue(v)

              return (
                <div
                  key={k}
                  style={{
                    padding: "6px 0",
                    borderBottom: "1px solid #f6f6f9",
                  }}
                >
                  <div style={fieldLabelStyle}>{k}</div>
                  <div style={fieldValueStyle}>
                    {isUrl ? (
                      <a
                        href={text}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#4945ff", fontSize: "13px" }}
                      >
                        {text.length > 50 ? text.slice(0, 50) + "…" : text}
                      </a>
                    ) : (
                      text
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Evidence */}
      {sub.evidenceUrl && (
        <div>
          <p style={sectionHeaderStyle}>Evidence</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {sub.evidenceType && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#666687",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {sub.evidenceType}
              </span>
            )}
            <a
              href={sub.evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#4945ff",
                fontSize: "13px",
                wordBreak: "break-all",
              }}
            >
              {sub.evidenceUrl}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Quick summary strip (always visible) ──────────────────────────────────────

function QuickSummary({ sub }: { sub: Submission }) {
  const f = sub.fields ?? {}
  const chips: { label: string; value: string }[] = []

  if (sub.submissionType === "library_claim") {
    if (f.name) chips.push({ label: "Library", value: String(f.name) })
    if (f.entityRef) chips.push({ label: "Ref", value: String(f.entityRef) })
    if (f.role)
      chips.push({ label: "Role", value: String(f.role).replaceAll("_", " ") })
    if (f.department) chips.push({ label: "Dept", value: String(f.department) })
  } else {
    if (f.name) chips.push({ label: "Name", value: String(f.name) })
    if (f.city) chips.push({ label: "City", value: String(f.city) })
    if (f.libraryType)
      chips.push({ label: "Type", value: String(f.libraryType) })
    if (f.operationalStatus)
      chips.push({ label: "Status", value: String(f.operationalStatus) })
  }

  if (chips.length === 0) return null

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        marginTop: "10px",
      }}
    >
      {chips.map(({ label, value }) => (
        <span
          key={label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 9px",
            borderRadius: "100px",
            background: "#f6f6f9",
            border: "1px solid #eaeaef",
            fontSize: "12px",
            color: "#32324d",
          }}
        >
          <span style={{ color: "#8e8ea9", fontSize: "11px" }}>{label}</span>
          <span style={{ fontWeight: 600 }}>{value}</span>
        </span>
      ))}
    </div>
  )
}

// ── Submission card ───────────────────────────────────────────────────────────

type PendingAction = "rejected" | "needs_info" | null

function SubmissionCard({
  sub,
  onUpdate,
}: {
  sub: Submission
  onUpdate: (id: string, status: string, note?: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const dateStr = new Date(sub.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const timeStr = new Date(sub.createdAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })

  const handleAction = async (status: string, note?: string) => {
    setUpdating(true)
    setPendingAction(null)
    try {
      await onUpdate(sub.documentId, status, note)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dcdce4",
        borderRadius: "8px",
        marginBottom: "16px",
        overflow: "hidden",
        boxShadow: "0 1px 6px rgba(33,33,52,0.07)",
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "18px 22px",
          borderBottom: expanded ? "1px solid #f0f0ff" : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          {/* Left side */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Type + target + status */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <TypeBadge type={sub.submissionType} />
              {sub.targetSlug && (
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#32324d",
                  }}
                >
                  {sub.targetSlug}
                </span>
              )}
              {sub.status !== "pending" && <StatusBadge status={sub.status} />}
            </div>

            {/* Submitter + date */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <Avatar name={sub.submittedByName} email={sub.submittedByEmail} />
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#32324d",
                    lineHeight: 1.2,
                  }}
                >
                  {sub.submittedByName ?? sub.submittedByEmail}
                </div>
                {sub.submittedByName && (
                  <div style={{ fontSize: "11px", color: "#8e8ea9" }}>
                    {sub.submittedByEmail}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "#c0c0cf",
                  marginLeft: "4px",
                }}
              >
                ·
              </span>
              <span style={{ fontSize: "11px", color: "#8e8ea9" }}>
                {dateStr} at {timeStr}
              </span>
            </div>

            {/* Always-visible quick summary */}
            <QuickSummary sub={sub} />

            {/* Note / edit summary */}
            {(sub.note || sub.editSummary) && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "8px 12px",
                  background: "#f6f6f9",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: "#32324d",
                  lineHeight: 1.5,
                  borderLeft: "3px solid #dcdce4",
                }}
              >
                {sub.editSummary ?? sub.note}
              </div>
            )}
          </div>

          {/* Right side — expand toggle */}
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #dcdce4",
              background: expanded ? "#f0f0ff" : "#fff",
              color: expanded ? "#4945ff" : "#666687",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            {expanded ? "Collapse" : "Review"}
            <IconChevron open={expanded} />
          </button>
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div
          style={{
            padding: "20px 22px",
            background: "#fafafa",
            borderBottom: "1px solid #f0f0ff",
          }}
        >
          {sub.submissionType === "library_claim" ? (
            <LibraryClaimPanel sub={sub} />
          ) : (
            <FieldsPanel sub={sub} />
          )}

          {/* Moderator review note */}
          {sub.reviewNote && (
            <div
              style={{
                marginTop: "16px",
                padding: "10px 14px",
                background: "#fff3e0",
                border: "1px solid #fcd34d",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#92400e",
                fontStyle: "italic",
              }}
            >
              <span style={{ fontWeight: 600, fontStyle: "normal" }}>
                Moderator note:{" "}
              </span>
              {sub.reviewNote}
            </div>
          )}
        </div>
      )}

      {/* Inline note input */}
      {pendingAction && (
        <div style={{ padding: "0 22px 16px", background: "#fafafa" }}>
          <InlineNoteInput
            label={
              pendingAction === "rejected"
                ? "Rejection reason (shown to submitter)"
                : "What information is needed?"
            }
            placeholder={
              pendingAction === "rejected"
                ? "Explain why this submission cannot be approved…"
                : "Describe what additional information or evidence is required…"
            }
            onConfirm={(note) =>
              void handleAction(pendingAction, note || undefined)
            }
            onCancel={() => setPendingAction(null)}
            loading={updating}
          />
        </div>
      )}

      {/* Action footer */}
      {(sub.status === "pending" || sub.status === "needs_info") &&
        !pendingAction && (
          <div
            style={{
              padding: "12px 22px",
              background: "#fff",
              borderTop: "1px solid #f0f0ff",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Button
              startIcon={<IconCheck />}
              variant="success-light"
              size="S"
              disabled={updating}
              onClick={() => void handleAction("approved")}
            >
              {sub.submissionType === "library_claim"
                ? "Approve & Verify"
                : "Approve"}
            </Button>
            <Button
              startIcon={<IconX />}
              variant="danger-light"
              size="S"
              disabled={updating}
              onClick={() => setPendingAction("rejected")}
            >
              Reject
            </Button>
            <Button
              startIcon={<IconInfo />}
              variant="secondary"
              size="S"
              disabled={updating}
              onClick={() => setPendingAction("needs_info")}
            >
              Needs Info
            </Button>
            {updating && (
              <span
                style={{
                  marginLeft: "8px",
                  color: "#8e8ea9",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <IconLoader /> Saving…
              </span>
            )}
          </div>
        )}
    </div>
  )
}

// ── Summary count chip ────────────────────────────────────────────────────────

function CountChip({ count }: { count: number }) {
  if (count === 0) return null

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "18px",
        height: "18px",
        padding: "0 5px",
        borderRadius: "9px",
        background: "#4945ff",
        color: "#fff",
        fontSize: "10px",
        fontWeight: 700,
        marginLeft: "6px",
      }}
    >
      {count}
    </span>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export function ModerationDashboard() {
  const { get, put } = useFetchClient()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [typeFilter, setTypeFilter] = useState("all")
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})

  const load = useCallback(
    async (status: string) => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await get(
          `/content-moderation/submissions?status=${encodeURIComponent(status)}`
        )
        const items = Array.isArray((data as { data?: unknown })?.data)
          ? (data as { data: Submission[] }).data
          : []
        setSubmissions(items)
        setCounts((prev) => ({ ...prev, [status]: items.length }))
      } catch (err) {
        setError("Failed to load submissions.")
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [get]
  )

  useEffect(() => {
    void load(statusFilter)
  }, [statusFilter, load])

  const updateStatus = useCallback(
    async (id: string, status: string, reviewNote?: string) => {
      await put(`/content-moderation/submissions/${id}/status`, {
        status,
        reviewNote,
      })
      void load(statusFilter)
    },
    [put, load, statusFilter]
  )

  const allTypes = useMemo(
    () => Array.from(new Set(submissions.map((s) => s.submissionType))),
    [submissions]
  )

  const filtered =
    typeFilter === "all"
      ? submissions
      : submissions.filter((s) => s.submissionType === typeFilter)

  return (
    <Box padding={8} background="neutral100" minHeight="100vh">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Page header */}
      <Flex
        justifyContent="space-between"
        alignItems="flex-start"
        marginBottom={6}
      >
        <div>
          <Typography variant="alpha" fontWeight="bold">
            Moderation Queue
          </Typography>
          <Box marginTop={1}>
            <Typography variant="epsilon" textColor="neutral500">
              Review and action user-submitted library data. Approving a library
              claim automatically sets the user&apos;s verified librarian
              status.
            </Typography>
          </Box>
        </div>
        <Button
          variant="ghost"
          size="S"
          onClick={() => void load(statusFilter)}
        >
          ↻ Refresh
        </Button>
      </Flex>

      {/* Status tabs */}
      <Tabs.Root
        value={statusFilter}
        onValueChange={(val) => {
          setStatusFilter(val)
          setTypeFilter("all")
        }}
      >
        <Tabs.List aria-label="Submission status filter">
          {STATUS_TABS.map((tab) => (
            <Tabs.Trigger key={tab.id} value={tab.id}>
              <span style={{ display: "flex", alignItems: "center" }}>
                {tab.label}
                {counts[tab.id] ? <CountChip count={counts[tab.id]!} /> : null}
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {STATUS_TABS.map((tab) => (
          <Tabs.Content key={tab.id} value={tab.id}>
            <Box padding={6}>
              {/* Type filter pills */}
              {!loading && allTypes.length > 1 && (
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    marginBottom: "20px",
                    flexWrap: "wrap",
                  }}
                >
                  {[
                    { id: "all", label: "All types" },
                    ...allTypes.map((t) => ({
                      id: t,
                      label: TYPE_LABELS[t] ?? t,
                    })),
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setTypeFilter(id)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "100px",
                        fontSize: "12px",
                        fontWeight: 500,
                        border: "1px solid",
                        cursor: "pointer",
                        transition: "all 0.12s",
                        borderColor: typeFilter === id ? "#4945ff" : "#dcdce4",
                        background: typeFilter === id ? "#f0f0ff" : "#fff",
                        color: typeFilter === id ? "#4945ff" : "#666687",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Result count */}
              {!loading && !error && filtered.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <Typography variant="pi" textColor="neutral500">
                    {filtered.length} submission
                    {filtered.length !== 1 ? "s" : ""}
                    {typeFilter !== "all"
                      ? ` · ${TYPE_LABELS[typeFilter] ?? typeFilter}`
                      : ""}
                  </Typography>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <Flex justifyContent="center" padding={8} gap={2}>
                  <IconLoader />
                  <Typography textColor="neutral500">
                    Loading submissions…
                  </Typography>
                </Flex>
              )}

              {/* Error */}
              {error && (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#ffeaea",
                    border: "1px solid #f5c0be",
                    borderRadius: "8px",
                  }}
                >
                  <Typography textColor="danger600">{error}</Typography>
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && filtered.length === 0 && (
                <div
                  style={{
                    padding: "48px 24px",
                    textAlign: "center",
                    background: "#fff",
                    border: "1px solid #dcdce4",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>✓</div>
                  <Typography variant="delta" textColor="neutral600">
                    All clear
                  </Typography>
                  <Box marginTop={1}>
                    <Typography textColor="neutral400">
                      No {tab.label.toLowerCase()} submissions
                      {typeFilter !== "all"
                        ? ` of type "${TYPE_LABELS[typeFilter] ?? typeFilter}"`
                        : ""}
                      .
                    </Typography>
                  </Box>
                </div>
              )}

              {/* Cards */}
              {!loading && !error && (
                <div style={{ maxWidth: "960px" }}>
                  {filtered.map((sub) => (
                    <SubmissionCard
                      key={sub.documentId}
                      sub={sub}
                      onUpdate={updateStatus}
                    />
                  ))}
                </div>
              )}
            </Box>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </Box>
  )
}
