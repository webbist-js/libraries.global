import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

type Cell = { kind: "yes"; note?: string } | { kind: "no" }

const ROWS: { label: string; cells: [Cell, Cell, Cell] }[] = [
  {
    label: "Suggest corrections and add libraries",
    cells: [{ kind: "yes" }, { kind: "yes" }, { kind: "yes" }],
  },
  {
    label: "Share photos and sources",
    cells: [{ kind: "yes" }, { kind: "yes" }, { kind: "yes" }],
  },
  {
    label: "Review and accept others' changes",
    cells: [
      { kind: "no" },
      { kind: "yes" },
      { kind: "yes", note: "For own library" },
    ],
  },
  {
    label: "Publish own changes without review",
    cells: [
      { kind: "no" },
      { kind: "yes", note: "Minor fixes only" },
      { kind: "yes", note: "For own library" },
    ],
  },
  {
    label: "Steward a library record",
    cells: [{ kind: "no" }, { kind: "no" }, { kind: "yes" }],
  },
]

const COLUMNS = [
  { title: "Community participant", sub: "Anyone with an account" },
  { title: "Trusted contributor", sub: "After 10+ accepted, sourced changes" },
  { title: "Verified library staff", sub: "Confirmed by the review team" },
]

function CellValue({ cell }: { cell: Cell }) {
  if (cell.kind === "no") {
    return (
      <span className="text-[14px]" style={{ color: T.ink.faint }}>
        — No
      </span>
    )
  }

  return (
    <span
      className="text-[14px] font-semibold"
      style={{ color: "var(--tint-public-fg)" }}
    >
      ✓ {cell.note ?? "Yes"}
    </span>
  )
}

export function RolesTable() {
  return (
    <section className="mx-auto w-full max-w-[1360px] px-4 py-12 sm:px-8">
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
        Roles and what they can do
      </h2>
      <p
        className="mt-2 mb-6 max-w-[62ch] text-[16px] leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        Roles are granted for care and accuracy, never bought with points.
        Library staff verification is a separate check.
      </p>

      <div
        className="overflow-x-auto rounded-[20px]"
        style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
      >
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border.divider}` }}>
              <th
                scope="col"
                className="px-6 py-4 text-[14px] font-medium"
                style={{ color: T.ink.dim }}
              >
                What you can do
              </th>
              {COLUMNS.map((column) => (
                <th key={column.title} scope="col" className="px-6 py-4">
                  <span
                    className="block text-[15px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {column.title}
                  </span>
                  <span
                    className="block text-[13px] font-normal"
                    style={{ color: T.ink.low }}
                  >
                    {column.sub}
                  </span>
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
                  className="px-6 py-3.5 text-[15px] font-normal"
                  style={{ color: T.ink.base }}
                >
                  {row.label}
                </th>
                {row.cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-6 py-3.5">
                    <CellValue cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 mb-0 text-[14px]" style={{ color: T.ink.dim }}>
        Staff verification lets you steward your library&rsquo;s record. It
        doesn&rsquo;t mean the library endorses this project.{" "}
        <GlobalLink
          href="/contribute/claim"
          className="underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          Request staff verification
        </GlobalLink>
      </p>
    </section>
  )
}
