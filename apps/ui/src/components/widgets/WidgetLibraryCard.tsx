"use client"
import { Icon } from "@iconify/react"
import type { WidgetLibrary, WidgetConfig, WidgetType } from "@repo/shared-data"

import { STAFF_LINK } from "@/components/staff/StaffPanel"
import { widgetDistance } from "@/components/widgets/presentation"
import { widgetCopy } from "@/lib/widgets/copy"

type CardProps = {
  readonly r: WidgetLibrary
  readonly c: WidgetConfig
  readonly type: WidgetType
  readonly accent: string
  readonly selected: string | null
  readonly onSelect: (id: string) => void
  readonly siteUrl: string
  readonly location: { lat: number; lng: number } | null
}

export function WidgetLibraryCard({
  r,
  c,
  type,
  accent,
  selected,
  onSelect,
  siteUrl,
  location,
}: CardProps) {
  const t = (text: string) => widgetCopy(c.locale, text)
  const recordLink = (href: string) =>
    `${siteUrl}${c.locale === "en" ? "" : `/${c.locale}`}${href}`

  return (
    <li
      className={`min-w-0 rounded-2xl border ${type === "finder" ? "p-3" : "p-4"}`}
      style={{
        borderColor:
          r.documentId === selected ? accent : "var(--t-border-line)",
        background:
          r.documentId === selected
            ? "var(--t-bg-surface)"
            : "var(--t-bg-deep)",
      }}
    >
      {type === "finder" ? (
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className="min-h-11 min-w-0 flex-1 text-left text-base font-semibold underline-offset-4 hover:underline focus-visible:outline-2"
            aria-pressed={selected === r.documentId}
            onClick={() => {
              onSelect(r.documentId)
            }}
          >
            {r.name}
          </button>
          {c.showLinks && r.href ? (
            <a
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-(--t-accent-primary) hover:bg-(--t-bg-surface) focus-visible:outline-2"
              href={recordLink(r.href)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t("View on Libraries Global")}: ${r.name} ${t("(new tab)")}`}
            >
              <Icon aria-hidden icon="mdi:open-in-new" width={16} />
            </a>
          ) : null}
        </div>
      ) : (
        <h3 className="type-small-heading m-0">{r.name}</h3>
      )}
      <WidgetLibraryFacts r={r} c={c} type={type} />
      {c.showHours ? (
        <WidgetLibraryHours r={r} type={type} locale={c.locale} />
      ) : null}
      {c.showAccess ? (
        <p className="mt-2 text-sm">
          {t("Step-free:")}{" "}
          {r.facilities[0] === "unknown"
            ? t("not recorded")
            : t(r.facilities[0] ?? "unknown")}
        </p>
      ) : null}
      {type !== "finder" && c.showLinks && r.href ? (
        <a
          className={`${STAFF_LINK} mt-2 inline-flex min-h-11 items-center text-sm`}
          href={recordLink(r.href)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("View on Libraries Global")}
          <span className="sr-only">{t("(new tab)")}</span>
        </a>
      ) : null}
      {location && r.location ? (
        <p className="mt-1 text-sm">
          {widgetDistance(location, r.location).toFixed(1)}{" "}
          {t("km away in a straight line")}
        </p>
      ) : null}
    </li>
  )
}

function WidgetLibraryFacts({
  r,
  c,
  type,
}: Pick<CardProps, "r" | "c" | "type">) {
  const t = (text: string) => widgetCopy(c.locale, text)

  return (
    <>
      {" "}
      <p className="mt-1 text-sm text-(--t-ink-dim)">
        {r.address || r.city || t("Address not recorded")}
      </p>
      <p
        className={
          type === "finder"
            ? "sr-only"
            : "mt-1 text-xs font-semibold text-(--t-ink-dim)"
        }
      >
        {r.libraryType}
      </p>
      {r.libraryType === "Mobile" ? (
        <p className="mt-1 text-xs">
          {t(
            "Mobile library — see the original record for stops and timetable. Mapped coordinates show its listed base."
          )}
        </p>
      ) : null}
      {!r.location && type === "finder" ? (
        <p className="mt-1 text-xs font-semibold">{t("Not on map")}</p>
      ) : null}
      {r.locale !== c.locale ? (
        <p className="mt-1 text-xs">
          {t("Content shown in")} {r.locale}; {t("translation unavailable.")}
        </p>
      ) : null}
      {r.operationalStatus !== "open" ? (
        <p className="mt-2 text-sm font-semibold">
          {t("Recorded status:")} {r.operationalStatus.replaceAll("_", " ")}
        </p>
      ) : null}
    </>
  )
}

function WidgetLibraryHours({
  r,
  type,
  locale,
}: {
  readonly r: WidgetLibrary
  readonly type: WidgetType
  readonly locale: string
}) {
  const t = (text: string) => widgetCopy(locale, text)

  return (
    <details className={`${type === "finder" ? "mt-0" : "mt-2"} text-sm`}>
      <summary className="min-h-11 cursor-pointer py-2">
        {r.hours.length
          ? t("Regular recorded hours")
          : t("Opening hours not recorded")}
      </summary>
      {r.hours.length ? (
        <>
          <ul className="list-none space-y-1 pl-0">
            {r.hours.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <p className="mt-2">
            {t("Check the library for temporary changes.")}
          </p>
        </>
      ) : null}
    </details>
  )
}
