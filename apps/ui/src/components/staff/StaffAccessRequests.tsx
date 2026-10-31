import { useTranslations } from "next-intl"

import { LibraryAccessBadge } from "@/components/staff/LibraryAccessBadge"
import { StaffPanel, STAFF_LINK } from "@/components/staff/StaffPanel"
import { Link } from "@/lib/navigation"
import type { MySubmissionRow } from "@/lib/role-application"

/** Only the signed-in person's recorded claims reach this summary. */
export function StaffAccessRequests({
  requests,
  unavailable,
}: {
  readonly requests: MySubmissionRow[]
  readonly unavailable: boolean
}) {
  const t = useTranslations("staffWorkspace")

  return (
    <StaffPanel title={t("accessRequests")} compact>
      {unavailable ? (
        <p role="status" className="m-0 text-(--t-ink-dim)">
          {t("accessUnavailable")}
        </p>
      ) : (
        <>
          <p className="mt-0 text-(--t-ink-dim)">{t("accessRequestsLead")}</p>
          <ul className="m-0 list-none divide-y divide-(--t-border-line) p-0">
            {requests.map((request) => {
              const fields = request.fields as Record<string, unknown> | null
              const name =
                request.targetLabel ||
                (typeof fields?.name === "string" ? fields.name : null) ||
                t("claimLibrary")

              return (
                <li
                  key={request.documentId}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <span className="min-w-0 font-semibold wrap-anywhere">
                    {name}
                  </span>
                  <LibraryAccessBadge status={request.status ?? ""} />
                </li>
              )
            })}
          </ul>
        </>
      )}
      <Link
        href="/contribute/submissions"
        className={`${STAFF_LINK} mt-3 inline-flex min-h-11 items-center`}
      >
        {t("viewAccessRequests")}
      </Link>
    </StaffPanel>
  )
}
