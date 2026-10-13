import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

const typeGroups = [
  { label: "Public", types: ["Public", "Municipal"] },
  { label: "Academic", types: ["Academic", "University"] },
  { label: "National", types: ["National"] },
  { label: "State & Parliamentary", types: ["State", "Parliamentary"] },
  { label: "Special & Archive", types: ["Special", "Archive"] },
  { label: "Mobile", types: ["Mobile"] },
  { label: "Digital", types: ["Digital"] },
  { label: "Other", types: ["Monastic", "Private", "Cultural", "Other"] },
]

export type PlaceGapInsight = {
  key: string
  label: string
  missing: number
  eligible: number
  type?: string
}
const number = (value: number) => value.toLocaleString("en-GB")
const percent = (value: number, total: number) =>
  total && value > 0 && value / total < 0.001
    ? "<0.1%"
    : total
      ? ((100 * value) / total).toLocaleString("en-GB", {
          maximumFractionDigits: 1,
        }) + "%"
      : "0%"

function InsightRow({
  label,
  count,
  total,
  href,
  small,
  bar = true,
  muted = false,
}: {
  readonly label: string
  readonly count: number
  readonly total: number
  readonly href?: string
  readonly small: boolean
  readonly bar?: boolean
  readonly muted?: boolean
}) {
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span
          className={
            href && bar
              ? "font-semibold underline underline-offset-3"
              : undefined
          }
          style={href && bar ? { color: T.accent.primary } : undefined}
        >
          {label}
        </span>
        <span className="shrink-0 tabular-nums">
          {number(count)}
          {!small ? (
            <span style={{ color: T.ink.dim }}> · {percent(count, total)}</span>
          ) : null}
        </span>
      </span>
      {!small && bar ? (
        <span
          aria-hidden="true"
          className="mt-2 block h-2 overflow-hidden rounded-full"
          style={{ background: T.bg.muted }}
        >
          <span
            className="block h-full rounded-full"
            style={{
              width: Math.min(100, total ? (count / total) * 100 : 0) + "%",
              background: muted ? "#8B86C9" : T.accent.primary,
            }}
          />
        </span>
      ) : null}
    </>
  )

  return (
    <li>
      {href ? (
        <GlobalLink href={href} className="block min-h-11 py-2 hover:underline">
          {body}
        </GlobalLink>
      ) : (
        <div className="min-h-11 py-2">{body}</div>
      )}
    </li>
  )
}

export function PlaceInsights({
  name,
  level,
  slug,
  total,
  types = [],
  typesAvailable = true,
  childPlaces = [],
  childrenAvailable = true,
  gapRows = null,
}: {
  readonly name: string
  readonly level: "continent" | "country" | "region"
  readonly slug: string
  readonly total: number
  readonly types?: readonly { type: string; count: number }[]
  readonly typesAvailable?: boolean
  readonly childPlaces?: readonly {
    name: string
    slug: string
    count: number
  }[]
  readonly childrenAvailable?: boolean
  readonly gapRows?: readonly PlaceGapInsight[] | null
}) {
  if (!total) return null
  const small = total < 10
  const href = (extra: Record<string, string>) =>
    "/libraries?" + new URLSearchParams({ [level]: slug, ...extra })
  const groups = typeGroups
    .map((group) => ({
      ...group,
      count: types
        .filter((row) => group.types.includes(row.type))
        .reduce((sum, row) => sum + row.count, 0),
    }))
    .filter((group) => group.count > 0)
  const untyped = Math.max(
    0,
    total - types.reduce((sum, row) => sum + row.count, 0)
  )
  const physical = Math.max(
    0,
    total - (types.find((row) => row.type === "Digital")?.count ?? 0)
  )
  const places = [...childPlaces]
    .filter((child) => child.count > 0)
    .sort((a, b) => b.count - a.count)
  const leaders = places.slice(0, 3)
  const leadingCount = leaders.reduce((sum, row) => sum + row.count, 0)
  const otherCount = places.slice(3).reduce((sum, row) => sum + row.count, 0)
  const empty = childPlaces.filter((child) => child.count === 0).length
  const unassigned = Math.max(
    0,
    physical - places.reduce((sum, child) => sum + child.count, 0)
  )
  const childLevel =
    level === "continent" ? "country" : level === "country" ? "region" : "area"
  const browserId =
    level === "continent"
      ? "countries"
      : level === "country"
        ? "regions"
        : "areas"
  const gaps = new Map<
    string,
    { key: string; label: string; missing: number; eligible: number }
  >()
  for (const row of gapRows ?? []) {
    const current = gaps.get(row.key) ?? {
      key: row.key,
      label: row.label.split(": ").at(-1) ?? row.label,
      missing: 0,
      eligible: 0,
    }
    current.missing += row.missing
    current.eligible += row.eligible
    gaps.set(row.key, current)
  }
  const missing = [...gaps.values()]
    .filter((row) => row.missing > 0)
    .sort((a, b) => b.missing - a.missing)
  if (small)
    return (
      <section
        aria-label={`What the index shows for ${name}`}
        className="rounded-2xl border p-6"
        style={{ background: T.bg.deep, borderColor: T.border.line }}
      >
        <h2 className="m-0 text-[28px]" style={{ fontFamily: T.font.serif }}>
          The index in {name}
        </h2>
        <p
          className="mt-3 mb-0 text-base leading-relaxed"
          style={{ color: T.ink.dim }}
        >
          {number(total)} {total === 1 ? "library is" : "libraries are"}{" "}
          documented so far.
          {typesAvailable && groups.length
            ? " Recorded types: " +
              groups
                .map(
                  (group) =>
                    number(group.count) + " " + group.label.toLowerCase()
                )
                .join(", ") +
              "."
            : " Library types are not recorded yet."}
          {childrenAvailable && places.length
            ? " Records are in " +
              places.map((place) => place.name).join(", ") +
              "."
            : ""}
          {untyped > 0 && typesAvailable
            ? " " + number(untyped) + " have no type recorded yet."
            : ""}
        </p>
        {gapRows === null ? (
          <p role="status" className="text-sm">
            Missing-detail counts are temporarily unavailable.
          </p>
        ) : missing.length ? (
          <p className="mt-3 mb-0 text-sm leading-relaxed">
            Help with a missing detail:{" "}
            {missing.slice(0, 3).map((row, index) => (
              <span key={row.key}>
                {index ? " · " : ""}
                <GlobalLink
                  href={href({ needs: row.key })}
                  className="inline-flex min-h-11 items-center underline"
                  style={{ color: T.accent.primary }}
                >
                  {row.label.toLowerCase()} ({number(row.missing)})
                </GlobalLink>
              </span>
            ))}
          </p>
        ) : null}
      </section>
    )
  const cardStyle = { background: T.bg.deep, borderColor: T.border.line }
  const headingStyle = { fontFamily: T.font.serif, color: T.ink.base }

  return (
    <section aria-labelledby={"insights-" + slug}>
      <h2
        id={"insights-" + slug}
        className="m-0 text-[clamp(30px,4vw,40px)] leading-tight"
        style={headingStyle}
      >
        What the index shows for {name}
      </h2>
      <p
        className="mt-3 mb-6 text-base leading-relaxed"
        style={{ color: T.ink.dim }}
      >
        A picture of the libraries documented here, and where contributions
        could help. These figures describe the index, not every library that
        exists.
      </p>
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <article
          className="flex flex-col rounded-[22px] border p-6"
          style={cardStyle}
        >
          <h3
            className="m-0 mb-3 text-[26px] leading-tight"
            style={headingStyle}
          >
            Library types
          </h3>
          <p className="mb-4 text-[13px]" style={{ color: T.ink.dim }}>
            {small
              ? "Types recorded so far."
              : "Share of all " + number(total) + " documented libraries."}
          </p>
          {!typesAvailable ? (
            <p role="status" className="text-sm">
              Type counts are temporarily unavailable.
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {groups.map((group) => (
                <InsightRow
                  key={group.label}
                  label={group.label}
                  count={group.count}
                  total={total}
                  href={href({ type: group.types.join(",") })}
                  small={small}
                />
              ))}
              {untyped > 0 ? (
                <InsightRow
                  label="Type not recorded"
                  count={untyped}
                  total={total}
                  small={small}
                />
              ) : null}
            </ul>
          )}
          <p
            className="mt-auto mb-0 pt-4 text-[13px] leading-[1.5]"
            style={{ color: T.ink.dim }}
          >
            Select a type to search it. A mobile library counts once, not once
            per timetable stop.
          </p>
        </article>
        <article
          className="flex flex-col rounded-[22px] border p-6"
          style={cardStyle}
        >
          <h3
            className="m-0 mb-3 text-[26px] leading-tight"
            style={headingStyle}
          >
            Where records are
          </h3>
          {!childrenAvailable || !typesAvailable ? (
            <p role="status" className="text-sm">
              Place counts are temporarily unavailable.
            </p>
          ) : (
            <>
              {small ? (
                <p className="text-sm leading-relaxed">
                  {places.length
                    ? number(physical) +
                      " place-based " +
                      (physical === 1 ? "library is" : "libraries are") +
                      " documented across " +
                      number(places.length) +
                      " " +
                      (places.length === 1 ? "child place." : "child places.")
                    : "No child-place assignments are recorded yet."}
                </p>
              ) : leadingCount / physical >= 0.6 ? (
                <p className="text-[24px] leading-tight" style={headingStyle}>
                  {leaders.map((child) => child.name).join(", ")} account for{" "}
                  {percent(leadingCount, physical)} of place-based records.
                </p>
              ) : null}
              <ul className="m-0 list-none p-0">
                {leaders.map((child) => (
                  <InsightRow
                    key={child.slug}
                    label={child.name}
                    count={child.count}
                    total={physical}
                    href={
                      "/libraries?" +
                      new URLSearchParams({ [childLevel]: child.slug })
                    }
                    small={small}
                    bar={false}
                  />
                ))}
                {places.length > 3 ? (
                  <InsightRow
                    label={number(places.length - 3) + " other places"}
                    count={otherCount}
                    total={physical}
                    href={"#" + browserId}
                    small={small}
                    bar={false}
                  />
                ) : null}
              </ul>
              {empty ? (
                <GlobalLink
                  href={"#" + browserId}
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold"
                  style={{ color: T.accent.primary }}
                >
                  {number(empty)} places await their first record →
                </GlobalLink>
              ) : null}
              <p
                className="mt-auto mb-0 pt-4 text-[13px] leading-[1.5]"
                style={{ color: T.ink.dim }}
              >
                Geographic shares exclude digital libraries.
                {unassigned
                  ? " " +
                    number(unassigned) +
                    " records without a child-place assignment stay in the denominator."
                  : ""}
              </p>
            </>
          )}
        </article>
        <article
          className="flex flex-col rounded-[22px] border p-6"
          style={cardStyle}
        >
          <h3
            className="m-0 mb-3 text-[26px] leading-tight"
            style={headingStyle}
          >
            Missing details
          </h3>
          <p className="mb-4 text-[13px]" style={{ color: T.ink.dim }}>
            Records needing each detail, out of those it applies to.
          </p>
          {gapRows === null ? (
            <p role="status" className="text-sm leading-relaxed">
              Gap counts are temporarily unavailable. You can still improve a
              library you know.
            </p>
          ) : (
            <>
              <ul className="m-0 list-none p-0">
                {missing.slice(0, 5).map((row) => (
                  <InsightRow
                    key={row.key}
                    label={row.label}
                    count={row.missing}
                    total={row.eligible}
                    href={href({ needs: row.key })}
                    small={small}
                    muted
                  />
                ))}
              </ul>
              {missing.length > 5 ? (
                <details className="text-sm">
                  <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                    Show all missing details
                  </summary>
                  <ul className="m-0 list-none p-0">
                    {missing.slice(5).map((row) => (
                      <InsightRow
                        key={row.key}
                        label={row.label}
                        count={row.missing}
                        total={row.eligible}
                        href={href({ needs: row.key })}
                        small={small}
                        muted
                      />
                    ))}
                  </ul>
                </details>
              ) : null}
              {!missing.length ? (
                <p className="text-sm">
                  No gaps are reported for these details.
                </p>
              ) : null}
              <p
                className="mt-auto mb-0 pt-4 text-[13px] leading-[1.5]"
                style={{ color: T.ink.dim }}
              >
                One record may need several details. These counts overlap and
                cannot be added together.
              </p>
            </>
          )}
        </article>
      </div>
    </section>
  )
}
