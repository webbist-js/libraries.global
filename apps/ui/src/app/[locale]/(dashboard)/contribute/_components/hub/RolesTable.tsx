import { useTranslations as useUiTranslations } from "next-intl"

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

const ROWS: Row[] = [
  {
    label: "Suggest corrections, photos and sources",
    cells: [YES, YES, YES, YES, YES, YES],
  },
  { label: "Add a missing library", cells: [YES, YES, YES, YES, YES, YES] },
  {
    label: "Suggest Knowledge edits and translations, pitch Journal pieces",
    cells: [YES, YES, YES, YES, YES, YES],
  },
  {
    label: "Vote on suggested additions",
    cells: [YES, YES, YES, YES, YES, YES],
  },
  {
    label: "Start discussions, reply, react and follow conversations",
    cells: [YES, YES, YES, YES, YES, YES],
  },
  {
    label: "Edit a library’s record and connect its events feed",
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
    label: "Publish approved Knowledge edits directly",
    cells: [NO, NO, YES, NO, NO, YES],
  },
  {
    label: "Publish approved Journal edits directly",
    cells: [NO, NO, NO, YES, NO, YES],
  },
  {
    label: "Review submissions in their queue and language",
    cells: [NO, NO, NO, NO, YES, { kind: "yes", note: "Every queue" }],
  },
  {
    label: "Review discussion messages and reports",
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
  { title: "Contributor", sub: "Anyone with an account" },
  { title: "Verified library staff", sub: "Confirmed through a library claim" },
  {
    title: "Knowledge editor",
    sub: "After five accepted changes",
    apply: "/contribute/knowledge/apply?role=wiki_editor",
  },
  {
    title: "Journal editor",
    sub: "After five accepted changes",
    apply: "/contribute/knowledge/apply?role=journal_editor",
  },
  {
    title: "Moderator",
    sub: "After five accepted changes",
    apply: "/contribute/knowledge/apply?role=moderator",
  },
  { title: "Editorial board", sub: "Reviews every queue and language" },
]

function CellValue({ cell }: { cell: Cell }) {
  const tUi = useUiTranslations("ui")

  if (cell.kind === "claim")
    return (
      <span className="text-sm" style={{ color: T.ink.dim }}>
        With a library claim
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
  return (
    <div className="px-6 pb-6 sm:px-8 sm:pb-8">
      <p
        className="mt-0 mb-4 max-w-[75ch] text-sm leading-relaxed"
        style={{ color: T.ink.dim }}
      >
        Roles are granted for care and accuracy, never bought with points or a
        plan. Every change is reviewed, whatever your role: editor roles change
        what happens once an edit is approved. Discussion posts and edits need
        another authorised reviewer, including posts by editors, moderators and
        the board.
      </p>

      <div
        className="overflow-x-auto rounded-[20px]"
        style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
      >
        <table className="w-full min-w-[1100px] border-collapse text-left">
          <caption className="sr-only">Roles and what they can do</caption>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border.divider}` }}>
              <th
                scope="col"
                className="px-6 py-4 text-sm font-medium"
                style={{ color: T.ink.dim }}
              >
                What you can do
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
                      Apply
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
        Points raise how much you can send at once, never your role.
      </p>
      <p className="mt-1.5 mb-0 text-sm" style={{ color: T.ink.dim }}>
        Staff verification lets you steward your library&rsquo;s record. It
        doesn&rsquo;t mean the library endorses this project.{" "}
        <GlobalLink
          href="/contribute/claim"
          className="underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          Claim your library
        </GlobalLink>
      </p>
    </div>
  )
}
