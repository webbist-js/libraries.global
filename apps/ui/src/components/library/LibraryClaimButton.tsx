"use client"

import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

interface LibraryClaimButtonProps {
  readonly compact?: boolean
  readonly card?: boolean
  readonly libraryDocumentId: string
  readonly librarySlug: string
  readonly libraryName: string
  readonly libraryEntityRef?: string
}

/**
 * The sidebar's "Work here?" line: a link to ask to look after the record
 * (through sign-in when needed). Hidden for someone who already does.
 */
export function LibraryClaimButton({
  compact = false,
  card = false,
  libraryDocumentId,
  librarySlug,
  libraryName,
  libraryEntityRef,
}: LibraryClaimButtonProps) {
  const t = useTranslations("libraryPage")
  const refParam = libraryEntityRef
    ? `&libraryEntityRef=${encodeURIComponent(libraryEntityRef)}`
    : ""
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const [isClaimed, setIsClaimed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session?.user || !libraryEntityRef) {
      const id = setTimeout(() => setIsClaimed(false), 0)

      return () => clearTimeout(id)
    }
    fetch("/api/profile/me/affiliations")
      .then((r) => r.json())
      .then((json: { entityRefs?: string[] }) => {
        setIsClaimed((json.entityRefs ?? []).includes(libraryEntityRef))
      })
      .catch(() => setIsClaimed(false))
  }, [session?.user, libraryEntityRef])

  if (sessionPending || isClaimed === null || isClaimed) return null

  const claimUrl = `/contribute/claim?librarySlug=${encodeURIComponent(librarySlug)}&libraryName=${encodeURIComponent(libraryName)}&libraryDocumentId=${encodeURIComponent(libraryDocumentId)}${refParam}`

  if (card)
    return (
      <DashboardSidebarCta
        title={t("workHere")}
        body={t("staffRecordNote")}
        action={{
          href: session?.user
            ? claimUrl
            : `/auth/signin?callbackUrl=${encodeURIComponent(claimUrl)}`,
          label: t("claimRecord"),
        }}
      >
        <details>
          <summary>{t("aboutClaims")}</summary>
          <p>{t("claimNote")}</p>
        </details>
      </DashboardSidebarCta>
    )

  if (compact)
    return (
      <div
        className="mt-2 text-sm leading-relaxed"
        style={{ color: T.ink.dim }}
      >
        <p className="m-0">
          {t("workHere")}{" "}
          <Link
            href={
              session?.user
                ? claimUrl
                : `/auth/signin?callbackUrl=${encodeURIComponent(claimUrl)}`
            }
            className="font-semibold underline underline-offset-4"
            style={{ color: T.accent.primary }}
          >
            {t("claimRecord")}
          </Link>
        </p>
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-xs">
            {t("aboutClaims")}
          </summary>
          <p className="mt-0">{t("claimNote")}</p>
        </details>
      </div>
    )

  return (
    <p className="m-0 px-1 text-sm leading-normal" style={{ color: T.ink.dim }}>
      Work here?{" "}
      <Link
        href={
          session?.user
            ? claimUrl
            : `/auth/signin?callbackUrl=${encodeURIComponent(claimUrl)}`
        }
        className="font-semibold underline underline-offset-[3px]"
        style={{ color: T.accent.primary }}
      >
        Ask to look after this record
      </Link>
      . A moderator checks each claim first. Claiming a record doesn&rsquo;t
      mean the library endorses Libraries Global.
    </p>
  )
}
