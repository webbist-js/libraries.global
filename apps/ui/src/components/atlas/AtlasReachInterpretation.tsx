"use client"

import {
  atlasCommunityGap,
  atlasReachDistribution,
  atlasReachInsights,
  type AtlasNetworkReachResult,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { SegmentedControl } from "@/components/ds/SegmentedControl"

const COLORS = ["#9E3A64", "#CE7891", "#E7BCC5", "#BCCBDC", "#6084AB"]
const number = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 })

export function AtlasReachInterpretation({
  result,
  minutes,
  onMinutes,
}: {
  result: AtlasNetworkReachResult
  minutes: number
  onMinutes: (value: number) => void
}) {
  const t = useTranslations("atlasInsights")
  const [section, setSection] = useState<"distribution" | "community">(
    "distribution"
  )
  const insights = atlasReachInsights(result, minutes)

  return (
    <>
      <div className="flex flex-col gap-6">
        <SegmentedControl
          layout="equal"
          label={t("sections")}
          value={section}
          onChange={setSection}
          options={[
            { value: "distribution", label: t("distribution") },
            { value: "community", label: t("community") },
          ]}
        />
        {section === "distribution" ? (
          <ReachDistribution
            result={result}
            minutes={minutes}
            onMinutes={onMinutes}
          />
        ) : (
          <ReachCommunity result={result} minutes={minutes} />
        )}
      </div>
      {insights ? (
        <aside
          aria-label={t("observations")}
          className="flex flex-col gap-2 border-l-2 border-(--t-accent-primary) pl-3 text-xs leading-relaxed text-(--t-ink-dim)"
        >
          {insights.additional !== null && insights.additional > 0 ? (
            <p className="m-0">
              {t("additional", {
                from: minutes,
                to: insights.maximumMinutes,
                residents: number(insights.additional),
              })}
            </p>
          ) : null}
          <p className="m-0">
            {t("beyond", {
              minutes: insights.maximumMinutes,
              residents: number(insights.beyondMaximum),
            })}
          </p>
        </aside>
      ) : null}
    </>
  )
}

function ReachDistribution({
  result,
  minutes,
  onMinutes,
}: {
  result: AtlasNetworkReachResult
  minutes: number
  onMinutes: (value: number) => void
}) {
  const t = useTranslations("atlasInsights")
  const [distributionMode, setDistributionMode] = useState<
    "bands" | "cumulative"
  >("bands")
  const bands = atlasReachDistribution(result)
  if (result.requestedMinutes !== undefined)
    return (
      <p className="m-0 text-xs leading-relaxed text-(--t-ink-dim)">
        {t("singleTimeDistribution", { minutes: result.requestedMinutes })}
      </p>
    )

  return (
    <section aria-label={t("distribution")} className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h3 className="m-0 text-sm font-semibold">{t("journeyTime")}</h3>
        <SegmentedControl
          layout="equal"
          label={t("distributionType")}
          value={distributionMode}
          onChange={setDistributionMode}
          options={[
            { value: "bands", label: t("bands") },
            { value: "cumulative", label: t("cumulative") },
          ]}
        />
        <p className="m-0 text-xs leading-relaxed text-(--t-ink-dim)">
          {t(
            distributionMode === "bands"
              ? "bandExplanation"
              : "cumulativeExplanation"
          )}
        </p>
      </div>
      {distributionMode === "bands" ? (
        bands ? (
          <figure className="m-0 space-y-3">
            <figcaption className="sr-only">{t("journeyTime")}</figcaption>
            {bands.map((band, i) => (
              <div key={band.from} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    {band.to === null
                      ? t("beyondTime", { minutes: band.from })
                      : t("band", { from: band.from, to: band.to })}
                  </span>
                  <strong className="tabular-nums">
                    {number(band.residents)}
                  </strong>
                </div>
                <div
                  aria-hidden="true"
                  className="h-2 overflow-hidden rounded-full bg-(--t-bg-muted)"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${result.totalResidents! > 0 ? (band.residents / result.totalResidents!) * 100 : 0}%`,
                      background:
                        i === 4 ? "#8C8998" : "var(--t-accent-primary)",
                      opacity: i === 4 ? 1 : 0.4 + i * 0.2,
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="m-0 pt-1 text-[11px] leading-relaxed text-(--t-ink-dim)">
              {t("rounding")}
            </p>
          </figure>
        ) : (
          <p role="status" className="text-xs text-(--t-ink-dim)">
            {t("incompleteDistribution")}
          </p>
        )
      ) : (
        <table className="w-full text-right text-xs tabular-nums">
          <caption className="sr-only">{t("cumulativeExplanation")}</caption>
          <thead className="text-(--t-ink-dim)">
            <tr>
              <th className="py-2 text-left">{t("time")}</th>
              <th>{t("residents")}</th>
              <th>{t("coverage")}</th>
            </tr>
          </thead>
          <tbody>
            {result.contours.map((band) => (
              <tr key={band.minutes} className="border-t border-(--t-divider)">
                <td className="text-left">
                  <button
                    type="button"
                    aria-pressed={band.minutes === minutes}
                    onClick={() => onMinutes(band.minutes)}
                    className="min-h-11 rounded px-1 font-semibold aria-pressed:text-(--t-accent-primary)"
                  >
                    {t("withinTime", { minutes: band.minutes })}
                  </button>
                </td>
                <td>
                  {band.residents === null
                    ? t("unknown")
                    : number(band.residents)}
                </td>
                <td>
                  {band.percent === null
                    ? t("unknown")
                    : `${band.percent.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function ReachCommunity({
  result,
  minutes,
}: {
  result: AtlasNetworkReachResult
  minutes: number
}) {
  const t = useTranslations("atlasInsights")
  const community = result.community
  const gap = community ? atlasCommunityGap(community, minutes) : null
  const groupName = (quintile: number | null) =>
    quintile === null
      ? t("unknownGroup")
      : t("group", { from: quintile * 2 - 1, to: quintile * 2 })

  return (
    <section aria-label={t("who")} className="flex flex-col gap-4">
      <div>
        <h3 className="m-0 text-sm font-semibold">{t("who")}</h3>
        <p className="mt-2 mb-0 text-xs leading-relaxed text-(--t-ink-dim)">
          {t("contextExplanation", { minutes })}
        </p>
      </div>
      {community?.state === "ready" && community.groups && community.release ? (
        <>
          <p className="m-0 text-xs font-semibold">
            {community.release.name} · {community.release.edition}
          </p>
          <p className="m-0 text-[11px] leading-relaxed text-(--t-ink-dim)">
            {t("groupExplanation")}
          </p>
          <figure className="m-0 space-y-4">
            <figcaption className="sr-only">{t("coverageByGroup")}</figcaption>
            {community.groups.map((group, i) => {
              const band = group.contours.find((b) => b.minutes === minutes)!

              return (
                <div key={group.quintile ?? "unknown"} className="space-y-1.5">
                  <div className="flex justify-between gap-2 text-xs">
                    <span>{groupName(group.quintile)}</span>
                    <strong>
                      {band.percent === null
                        ? t("noPopulation")
                        : `${band.percent.toFixed(1)}%`}
                    </strong>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-2 overflow-hidden rounded-full bg-(--t-bg-muted)"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${band.percent ?? 0}%`,
                        background: COLORS[i] ?? "#8C8998",
                      }}
                    />
                  </div>
                  <p className="m-0 text-[11px] text-(--t-ink-dim)">
                    {t("groupCounts", {
                      within: number(band.residents),
                      beyond: number(band.outsideResidents),
                    })}
                  </p>
                </div>
              )
            })}
          </figure>
          {gap && gap.points >= 0.05 ? (
            <p className="m-0 rounded-xl bg-(--t-bg-surface) p-3 text-xs leading-relaxed">
              {t("gap", {
                points: gap.points.toFixed(1),
                high: groupName(gap.high.quintile),
                low: groupName(gap.low.quintile),
              })}
            </p>
          ) : null}
          <details className="text-xs leading-relaxed text-(--t-ink-dim)">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold text-(--t-ink-base)">
              {t("allGroupFigures")}
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-right tabular-nums">
                <caption className="pb-3 text-left">
                  {t("outsideShareExplanation")}
                </caption>
                <thead>
                  <tr>
                    <th className="text-left">{t("deciles")}</th>
                    <th>{t("total")}</th>
                    <th>{t("within")}</th>
                    <th>{t("beyondLabel")}</th>
                    <th>{t("outsideShare")}</th>
                  </tr>
                </thead>
                <tbody>
                  {community.groups.map((group) => {
                    const b = group.contours.find((b) => b.minutes === minutes)!

                    return (
                      <tr
                        key={group.quintile ?? "unknown"}
                        className="border-t border-(--t-divider)"
                      >
                        <th className="py-3 text-left font-normal">
                          {groupName(group.quintile)}
                        </th>
                        <td>{number(group.totalResidents)}</td>
                        <td>{number(b.residents)}</td>
                        <td>{number(b.outsideResidents)}</td>
                        <td>
                          {b.shareOfOutside === null
                            ? t("unknown")
                            : `${b.shareOfOutside.toFixed(1)}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </details>
          <p className="m-0 text-[11px] leading-relaxed text-(--t-ink-dim)">
            {t("contextLimits")}
          </p>
          {community.release.country === "GB-SCT" ? (
            <p className="m-0 text-[11px] leading-relaxed text-(--t-ink-dim)">
              {t("simdLimits")}
            </p>
          ) : null}
          <details className="text-xs leading-relaxed text-(--t-ink-dim)">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">
              {t("contextMethod")}
            </summary>
            <p>{t("intersectionMethod")}</p>
            <p>
              {community.release.boundary} · {community.release.year}
            </p>
            <p>
              {t("populationMismatch", {
                year: result.population.year ?? "—",
              })}
            </p>
            <a
              href={community.release.sourceUrl}
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              {community.release.edition}
            </a>{" "}
            · {community.release.licence}
          </details>
        </>
      ) : (
        <p
          role="status"
          className="m-0 rounded-xl bg-(--t-bg-surface) p-3.5 text-xs leading-relaxed text-(--t-ink-dim)"
        >
          {t(
            community?.state === "incomplete"
              ? "incompleteContext"
              : community?.state === "insufficient"
                ? "insufficientContext"
                : "unavailableContext"
          )}
        </p>
      )}
    </section>
  )
}
