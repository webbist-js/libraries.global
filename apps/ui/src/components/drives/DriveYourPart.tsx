import { useTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"

import { earnedProLine, type PendingQuota, quotaLine } from "./task-panel.logic"

/** The signed-in reader's own counts; never cached with a public drive. */
export type DriveMine = { sent: number; inReview: number; accepted: number }

export function DriveYourPart({
  mine,
  quota,
  toEarnedPro,
}: {
  readonly mine: DriveMine | null
  readonly quota: PendingQuota | null
  readonly toEarnedPro: number | null
}) {
  const t = useTranslations("drivePage")
  const ui = useTranslations("ui")
  const line = quotaLine(quota)
  const stats = mine
    ? [
        { label: ui("sent"), count: mine.sent, color: null },
        {
          label: ui("in_review"),
          count: mine.inReview,
          color: T.accent.primary,
        },
        { label: ui("accepted"), count: mine.accepted, color: T.accent.ok },
      ]
    : null

  return (
    <section
      aria-labelledby="drive-your-part-heading"
      className="flex flex-col gap-3 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="drive-your-part-heading" className="type-small-heading m-0">
          {t("yourPart")}
        </h2>
        <span className="text-xs text-(--t-ink-dim)">{t("thisDrive")}</span>
      </div>
      {stats ? (
        <div className="grid grid-cols-3 divide-x divide-(--t-border-line) overflow-hidden rounded-[14px] border border-(--t-border-line)">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0 px-3 py-2.5">
              <p
                className="m-0 text-[27px] leading-tight"
                style={{ fontFamily: T.font.sans }}
              >
                {stat.count.toLocaleString("en-GB")}
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs text-(--t-ink-dim)">
                {stat.color ? (
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: stat.color }}
                  />
                ) : null}
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm text-(--t-ink-dim)" role="status">
          {t("loadingPart")}
        </p>
      )}
      <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-(--t-ink-dim)">
        {mine?.sent === 0 && mine.accepted === 0 ? (
          <p className="m-0">{t("nothingSent")}</p>
        ) : null}
        {line ? <p className="m-0">{line}</p> : null}
        {toEarnedPro != null ? (
          <p className="m-0">{earnedProLine(toEarnedPro)}</p>
        ) : null}
      </div>
    </section>
  )
}
