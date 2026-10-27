"use client"
import type { WidgetPresentationData } from "@/components/widgets/presentation"
import { widgetCopy } from "@/lib/widgets/copy"

export function WidgetCredits({
  data,
  siteUrl,
}: {
  readonly data: WidgetPresentationData
  readonly siteUrl: string
}) {
  const { config: c, publisher, attribution, checkedAt } = data
  const t = (text: string) => widgetCopy(c.locale, text)

  return (
    <footer className="mt-5 space-y-2 border-t border-(--t-border-line) pt-4 text-xs leading-relaxed text-(--t-ink-dim)">
      {c.showPublisher ? (
        <p className="m-0">
          {t("Published by")} {publisher}
        </p>
      ) : null}
      <p className="m-0">
        {t("Library data:")}{" "}
        <a
          className="underline"
          href={`${siteUrl}/legal/data-licence`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("Libraries Global contributors")}
        </a>
        {t(". Imported details retain their source licences.")}
      </p>
      {attribution.map((a) => (
        <p
          className="m-0"
          key={[a.label, a.url, a.licence, a.licenceUrl].join("|")}
        >
          {a.url ? (
            <a
              className="underline"
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {a.label}
            </a>
          ) : (
            a.label
          )}
          {a.licence ? (
            <>
              {" "}
              ·{" "}
              {a.licenceUrl ? (
                <a
                  className="underline"
                  href={a.licenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {a.licence}
                </a>
              ) : (
                a.licence
              )}
            </>
          ) : null}
        </p>
      ))}
      {!c.hidePowered ? (
        <a
          className="inline-flex min-h-11 items-center font-semibold underline"
          href={siteUrl || "/"}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("Powered by Libraries Global")}
        </a>
      ) : null}
      <p className="m-0">
        {t("Data checked")}{" "}
        {new Intl.DateTimeFormat(c.locale, {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(new Date(checkedAt))}
        {t(". Missing information is not evidence of absence.")}
      </p>
    </footer>
  )
}
