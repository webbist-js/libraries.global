import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

export type IncompleteRecord = {
  documentId: string
  slug: string
  name: string
  place: string
  percent: number
  missing: string[]
}

export type ContinentCount = { name: string; count: number }

function MissingChip({ label }: { label: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
      style={{ background: "var(--tint-special-bg)", color: T.accent.danger }}
    >
      Missing: {label}
    </span>
  )
}

export function RecordsThatNeedYou({
  records,
  continents,
  totalPublished,
}: {
  readonly records: IncompleteRecord[]
  readonly continents: ContinentCount[]
  readonly totalPublished: number
}) {
  const populated = continents.filter((c) => c.count > 0)
  const singleContinent = populated.length === 1 ? populated[0] : null

  return (
    <section className="mx-auto w-full max-w-[1360px] px-4 py-12 sm:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Left — incomplete records */}
        <div>
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
              Records that need you
            </h2>
            <GlobalLink
              href="/libraries?needs=hours,photo,facilities&sort=gaps"
              className="text-[14px] font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              See all incomplete records
            </GlobalLink>
          </div>

          <div
            className="overflow-hidden rounded-[20px]"
            style={{
              background: T.bg.deep,
              border: `1px solid ${T.border.line}`,
            }}
          >
            {records.map((record, index) => (
              <div
                key={record.documentId}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5"
                style={
                  index > 0
                    ? { borderTop: `1px solid ${T.border.divider}` }
                    : undefined
                }
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="m-0 text-[18px] font-medium"
                    style={{ fontFamily: T.font.serif, color: T.ink.base }}
                  >
                    {record.name}
                  </p>
                  <p
                    className="mt-0.5 mb-2 text-[14px]"
                    style={{ color: T.ink.dim }}
                  >
                    {record.place}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {record.missing.map((label) => (
                      <MissingChip key={label} label={label} />
                    ))}
                  </div>
                </div>

                <div className="w-[104px] shrink-0">
                  <p
                    className="m-0 mb-1.5 text-right text-[13px] font-semibold"
                    style={{ color: T.ink.dim }}
                  >
                    {record.percent}% complete
                  </p>
                  <div
                    aria-hidden="true"
                    className="h-[6px] overflow-hidden rounded-full"
                    style={{ background: T.bg.muted }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${record.percent}%`,
                        background: T.accent.ok,
                      }}
                    />
                  </div>
                </div>

                <GlobalLink
                  href={`/contribute/edit/${record.slug}`}
                  className="shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-surface)"
                  style={{
                    borderColor: T.border.hi,
                    color: T.ink.base,
                    background: T.bg.deep,
                  }}
                >
                  Help fill this in
                </GlobalLink>
              </div>
            ))}
          </div>
        </div>

        {/* Right — coverage card (dark ink) */}
        <div
          className="flex h-fit flex-col rounded-[20px] p-7"
          style={{ background: T.ink.base, color: "#fff" }}
        >
          <h2
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontSize: "24px",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            Most of the world isn&rsquo;t here yet
          </h2>
          <p
            className="mt-3 mb-5 text-[14.5px] leading-[1.6]"
            style={{ color: "rgba(255,255,255,.72)" }}
          >
            {singleContinent
              ? `All ${totalPublished.toLocaleString("en-GB")} published records are in ${singleContinent.name}. If you know a library anywhere else, you'd be among the first to document it.`
              : `${totalPublished.toLocaleString("en-GB")} records published so far. If you know a library somewhere we haven't reached, you'd be among the first to document it.`}
          </p>

          <dl className="m-0">
            {continents.map((continent, index) => (
              <div
                key={continent.name}
                className="flex items-baseline justify-between py-2.5"
                style={
                  index > 0
                    ? { borderTop: "1px solid rgba(255,255,255,.12)" }
                    : undefined
                }
              >
                <dt className="text-[15px]">{continent.name}</dt>
                <dd
                  className="m-0 text-[14px]"
                  style={{
                    color:
                      continent.count > 0 ? "#fff" : "rgba(255,255,255,.55)",
                    fontWeight: continent.count > 0 ? 600 : 400,
                  }}
                >
                  {continent.count > 0
                    ? `${continent.count.toLocaleString("en-GB")} records`
                    : "None yet"}
                </dd>
              </div>
            ))}
          </dl>

          <GlobalLink
            href="/contribute/add"
            className="mt-5 self-start rounded-full px-5 py-2.5 text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: "#fff", color: T.ink.base }}
          >
            {singleContinent
              ? `Add a library outside ${singleContinent.name}`
              : "Add a library"}
          </GlobalLink>
        </div>
      </div>
    </section>
  )
}
