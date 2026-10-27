import { Icon } from "@iconify/react"
import { FACILITY_CHECKLIST } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"

/**
 * The library page's "Tap Yes or No" answers (a correction with
 * `fields.kind: "facilities"`). Only checklist questions answered yes or no
 * are shown, as Strapi applies only those: a yes links the facility, a no
 * unlinks it and records it as absent.
 */
export function FacilitiesPanel({ fields }: { readonly fields: unknown }) {
  const tUi = useUiTranslations("ui")

  const answers = ((fields as { answers?: unknown } | null)?.answers ??
    {}) as Record<string, unknown>
  const rows = FACILITY_CHECKLIST.flatMap((check) => {
    const a = answers[check.label]

    return a === "yes" || a === "no"
      ? [{ label: check.label, yes: a === "yes" }]
      : []
  })

  if (rows.length === 0)
    return (
      <p className="m-0 text-base" style={{ color: T.ink.dim }}>
        No facility answers in this submission.
      </p>
    )

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm leading-[1.55]" style={{ color: T.ink.dim }}>
        Approving links each Yes to the library and records each No as absent,
        then publishes the library.
      </p>
      <table className="w-full border-collapse">
        <caption className="sr-only">Facility answers</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="py-2 pr-4 text-left text-sm font-semibold"
              style={{ color: T.ink.dim }}
            >
              Facility
            </th>
            <th
              scope="col"
              className="py-2 text-left text-sm font-semibold"
              style={{ color: T.ink.dim }}
            >
              Answer
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              style={{ borderTop: `1px solid ${T.border.divider}` }}
            >
              <th
                scope="row"
                className="py-2 pr-4 text-left text-base font-medium"
                style={{ color: T.ink.base }}
              >
                {r.label}
              </th>
              <td className="py-2 text-base">
                <span
                  className="inline-flex items-center gap-1.5 font-semibold"
                  style={{ color: r.yes ? T.accent.ok : T.accent.danger }}
                >
                  <Icon
                    aria-hidden="true"
                    icon={
                      r.yes
                        ? "mdi:check-circle-outline"
                        : "mdi:close-circle-outline"
                    }
                    width={18}
                    height={18}
                  />
                  {r.yes ? tUi("yes") : tUi("no")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
