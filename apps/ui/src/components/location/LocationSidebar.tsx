import { useTranslations } from "next-intl"

import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import GlobalLink from "@/components/global/GlobalLink"

export type LocationTreeEntry = {
  href: string
  label: string
  count?: number
  depth?: number
  current?: boolean
}

/** A bounded hierarchy of actual records, separate from the child coverage browser. */
export function LocationHierarchy({
  entries,
}: {
  readonly entries: readonly LocationTreeEntry[]
}) {
  const t = useTranslations("dashboard")

  return (
    <nav className="location-hierarchy" aria-label={t("placeHierarchy")}>
      <p className="record-nav-label">{t("browse")}</p>
      <ul>
        {entries.map((entry) => (
          <li
            key={entry.href}
            style={{ "--tree-depth": entry.depth ?? 0 } as React.CSSProperties}
          >
            <GlobalLink
              href={entry.href}
              aria-current={entry.current ? "page" : undefined}
            >
              {(entry.depth ?? 0) > 0 ? (
                <span aria-hidden className="location-tree-branch">
                  └
                </span>
              ) : null}
              <span>{entry.label}</span>
              {entry.count !== undefined ? (
                <span className="location-tree-count">
                  {entry.count.toLocaleString()}
                </span>
              ) : null}
            </GlobalLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function LocationSidebarCta({
  name,
  addHref,
  proposeHref,
}: {
  readonly name: string
  readonly addHref: string
  readonly proposeHref: string
}) {
  const t = useTranslations("dashboard")
  const ui = useTranslations("ui")

  return (
    <div className="location-sidebar-footer">
      <GlobalLink
        href="/contribute/submissions"
        className="location-submissions-link"
      >
        {t("yourSubmissions")}
      </GlobalLink>
      <DashboardSidebarCta
        title={t("knowLibrary", { place: name })}
        body={t("contributionNote")}
        action={{ href: addHref, label: ui("add_a_library") }}
        secondary={{ href: proposeHref, label: t("proposeDrive") }}
      />
    </div>
  )
}
