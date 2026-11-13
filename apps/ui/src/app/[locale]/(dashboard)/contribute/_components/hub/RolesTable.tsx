import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

/**
 * What each Contributor Role can do, as `@repo/access` and the moderation
 * plugin enforce it. Every change is reviewed whatever the role; editor
 * roles only change what happens once an edit is approved, and reviewing
 * belongs to moderators (in their queue and language) and the editorial
 * board. Points and plans never grant a role.
 */
type Cell =
  | { kind: "yes"; note?: string }
  | { kind: "no"; note?: string }
  | { kind: "claim" }

const YES: Cell = { kind: "yes" }
const NO: Cell = { kind: "no" }
const CLAIM: Cell = { kind: "claim" }

type Row = { label: string; cells: [Cell, Cell, Cell, Cell, Cell, Cell] }

function CellValue({ cell }: { cell: Cell }) {
  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  if (cell.kind === "claim")
    return (
      <span className="text-sm" style={{ color: T.ink.dim }}>
        {tStatic("contributeRoute.with_a_library_claim")}
      </span>
    )
  if (cell.kind === "no") {
    return (
      <span className="text-sm" style={{ color: T.ink.faint }}>
        — {cell.note ?? tUi("no")}
      </span>
    )
  }

  return (
    <span
      className="text-sm font-semibold"
      style={{ color: "var(--tint-public-fg)" }}
    >
      ✓ {cell.note ?? tUi("yes")}
    </span>
  )
}

export function RolesTable() {
  const tStatic = useTranslations("staticUi")
  const ROWS: Row[] = [
    {
      label: tStatic("contributeRoute.suggest_corrections_photos_and_sources"),
      cells: [YES, YES, YES, YES, YES, YES],
    },
    {
      label: tStatic("contributeRoute.add_a_missing_library"),
      cells: [YES, YES, YES, YES, YES, YES],
    },
    {
      label: tStatic(
        "contributeRoute.suggest_knowledge_edits_and_translations_pitch_journal_pieces"
      ),
      cells: [YES, YES, YES, YES, YES, YES],
    },
    {
      label: tStatic("contributeRoute.vote_on_suggested_additions"),
      cells: [YES, YES, YES, YES, YES, YES],
    },
    {
      label: tStatic(
        "contributeRoute.start_discussions_reply_react_and_follow_conversations"
      ),
      cells: [YES, YES, YES, YES, YES, YES],
    },
    {
      label: tStatic(
        "contributeRoute.edit_a_library_s_record_and_connect_its_events_feed"
      ),
      cells: [
        NO,
        { kind: "yes", note: "For your library" },
        CLAIM,
        CLAIM,
        CLAIM,
        CLAIM,
      ],
    },
    {
      label: tStatic(
        "contributeRoute.publish_approved_knowledge_edits_directly"
      ),
      cells: [NO, NO, YES, NO, NO, YES],
    },
    {
      label: tStatic("contributeRoute.publish_approved_journal_edits_directly"),
      cells: [NO, NO, NO, YES, NO, YES],
    },
    {
      label: tStatic(
        "contributeRoute.review_submissions_in_their_queue_and_language"
      ),
      cells: [NO, NO, NO, NO, YES, { kind: "yes", note: "Every queue" }],
    },
    {
      label: tStatic("contributeRoute.review_discussion_messages_and_reports"),
      cells: [
        NO,
        NO,
        NO,
        NO,
        { kind: "yes", note: "With Discussions queue and language access" },
        YES,
      ],
    },
  ]
  const COLUMNS: { title: string; sub: string; apply?: string }[] = [
    {
      title: tStatic("contributeRoute.contributor"),
      sub: tStatic("contributeModule.anyone_with_an_account"),
    },
    {
      title: tStatic("contributeRoute.verified_library_staff"),
      sub: tStatic("contributeModule.confirmed_through_a_library_claim"),
    },
    {
      title: tStatic("contributeRoute.knowledge_editor"),
      sub: tStatic("contributeModule.after_five_accepted_changes"),
      apply: "/contribute/knowledge/apply?role=wiki_editor",
    },
    {
      title: tStatic("contributeRoute.journal_editor"),
      sub: tStatic("contributeModule.after_five_accepted_changes"),
      apply: "/contribute/knowledge/apply?role=journal_editor",
    },
    {
      title: tStatic("contributeRoute.moderator"),
      sub: tStatic("contributeModule.after_five_accepted_changes"),
      apply: "/contribute/knowledge/apply?role=moderator",
    },
    {
      title: tStatic("contributeRoute.editorial_board"),
      sub: tStatic("contributeModule.reviews_every_queue_and_language"),
    },
  ]

  const tExisting = useTranslations()

  return (
    <div className="px-6 pb-6 sm:px-8 sm:pb-8">
      <p
        className="mt-0 mb-4 max-w-[75ch] text-sm leading-relaxed"
        style={{ color: T.ink.dim }}
      >
        {tStatic(
          "contributeRoute.roles_are_granted_for_care_and_accuracy_never_bought_with_points_or_a_plan_every_change_is_reviewed_"
        )}
      </p>

      <div
        className="overflow-x-auto rounded-[20px]"
        style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
      >
        <table className="w-full min-w-[1100px] border-collapse text-left">
          <caption className="sr-only">
            {tStatic("contributeRoute.roles_and_what_they_can_do")}
          </caption>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border.divider}` }}>
              <th
                scope="col"
                className="px-6 py-4 text-sm font-medium"
                style={{ color: T.ink.dim }}
              >
                {tExisting("staffOnboarding.benefitsNav")}
              </th>
              {COLUMNS.map((column) => (
                <th key={column.title} scope="col" className="px-6 py-4">
                  <span
                    className="block text-base font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {column.title}
                  </span>
                  <span
                    className="block text-sm font-normal"
                    style={{ color: T.ink.low }}
                  >
                    {column.sub}
                  </span>
                  {column.apply ? (
                    <GlobalLink
                      href={column.apply}
                      aria-label={`Apply to be a ${column.title}`}
                      className="mt-1 inline-block text-sm font-semibold underline underline-offset-[3px]"
                      style={{ color: T.accent.primary }}
                    >
                      {tStatic("contributeRoute.apply")}
                    </GlobalLink>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, index) => (
              <tr
                key={row.label}
                style={
                  index > 0
                    ? { borderTop: `1px solid ${T.border.divider}` }
                    : undefined
                }
              >
                <th
                  scope="row"
                  className="max-w-[320px] px-6 py-3.5 text-base font-normal"
                  style={{ color: T.ink.base }}
                >
                  {row.label}
                </th>
                {row.cells.map((cell, cellIndex) => (
                  <td key={COLUMNS[cellIndex]!.title} className="px-6 py-3.5">
                    <CellValue cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 mb-0 text-sm" style={{ color: T.ink.dim }}>
        {tStatic(
          "contributeRoute.points_raise_how_much_you_can_send_at_once_never_your_role"
        )}
      </p>
      <p className="mt-1.5 mb-0 text-sm" style={{ color: T.ink.dim }}>
        {tStatic(
          "contributeRoute.staff_verification_lets_you_steward_your_library_rsquo_s_record_it_doesn_rsquo_t_mean_the_library_en"
        )}{" "}
        <GlobalLink
          href="/contribute/claim"
          className="underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          {tExisting("membershipStaff.step0Title")}
        </GlobalLink>
      </p>
    </div>
  )
}
