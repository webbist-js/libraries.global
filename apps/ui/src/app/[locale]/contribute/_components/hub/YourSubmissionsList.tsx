import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

export type HubSubmission = {
  documentId: string
  submissionType: string
  status: string
  targetName: string | null
  createdAt: string
}

const ACTION_LABEL: Record<string, string> = {
  new_library: "Added a library",
  correction: "Suggested a correction",
  library_edit: "Edited a record",
  library_claim: "Staff verification",
  wiki_edit: "Knowledge edit",
  blog_submission: "Journal pitch",
  topic_suggestion: "Suggested a topic",
}

const STATUS_CHIP: Record<string, { label: string; bg: string; fg: string }> = {
  approved: {
    label: "✓ Accepted",
    bg: "var(--tint-public-bg)",
    fg: "var(--tint-public-fg)",
  },
  pending: {
    label: "In review",
    bg: "var(--tint-academic-bg)",
    fg: "var(--tint-academic-fg)",
  },
  needs_info: { label: "Needs changes", bg: "#F5EEDC", fg: "#6B5420" },
  rejected: {
    label: "Not accepted",
    bg: "var(--tint-special-bg)",
    fg: "var(--tint-special-fg)",
  },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function YourSubmissionsList({
  submissions,
  username,
}: {
  readonly submissions: HubSubmission[]
  readonly username?: string | null
}) {
  return (
    <section className="mx-auto w-full max-w-[1360px] px-4 py-12 sm:px-8">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(26px,3vw,32px)",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: T.ink.base,
          }}
        >
          Your submissions
        </h2>
        <GlobalLink
          href={username ? `/profile/${username}` : "/contribute/submissions"}
          className="text-[14px] font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          {username ? "View on your profile" : "See all submissions"}
        </GlobalLink>
      </div>

      {submissions.length === 0 ? (
        <div
          className="rounded-[20px] px-6 py-10 text-center"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
          }}
        >
          <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
            Nothing submitted yet — your first change will appear here.
          </p>
        </div>
      ) : (
        <ul
          className="m-0 list-none overflow-hidden rounded-[20px] p-0"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
          }}
        >
          {submissions.map((submission, index) => {
            const chip = STATUS_CHIP[submission.status] ?? STATUS_CHIP.pending!

            return (
              <li
                key={submission.documentId}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-4"
                style={
                  index > 0
                    ? { borderTop: `1px solid ${T.border.divider}` }
                    : undefined
                }
              >
                <span
                  className="w-[118px] shrink-0 rounded-full px-3 py-1 text-center text-[13px] font-semibold"
                  style={{ background: chip.bg, color: chip.fg }}
                >
                  {chip.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[15px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {ACTION_LABEL[submission.submissionType] ?? "Made a change"}
                  </span>
                  {submission.targetName ? (
                    <span
                      className="block text-[14px]"
                      style={{ color: T.ink.dim }}
                    >
                      {submission.targetName}
                    </span>
                  ) : null}
                </span>
                <span
                  className="shrink-0 text-[14px]"
                  style={{ color: T.ink.low }}
                >
                  {formatDate(submission.createdAt)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function SignInPromptCard() {
  return (
    <section className="mx-auto w-full max-w-[1360px] px-4 py-12 sm:px-8">
      <div
        className="flex flex-wrap items-center justify-between gap-6 rounded-[20px] px-8 py-8"
        style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
      >
        <div className="min-w-[260px] flex-1">
          <h2
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontSize: "24px",
              fontWeight: 500,
              color: T.ink.base,
            }}
          >
            Every change starts with an account
          </h2>
          <p
            className="mt-2 mb-0 max-w-[56ch] text-[15px] leading-[1.6]"
            style={{ color: T.ink.dim }}
          >
            Create a free account to suggest corrections, add libraries and
            share photos. Every accepted change is credited to you.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2">
          <GlobalLink
            href="/auth/register"
            className="rounded-full px-6 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
            style={{ background: T.accent.primary }}
          >
            Create a free account
          </GlobalLink>
          <GlobalLink
            href="/auth/signin"
            className="text-[14px] underline underline-offset-[3px]"
            style={{ color: T.ink.dim }}
          >
            Already have an account? Sign in
          </GlobalLink>
        </div>
      </div>
    </section>
  )
}
