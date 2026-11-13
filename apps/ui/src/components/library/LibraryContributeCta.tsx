"use client"

import { useTranslations } from "next-intl"

import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { useCorrectionDrawer } from "@/components/library/LibraryCorrection"
import { useMounted } from "@/hooks/useMounted"
import { useHydratedSession } from "@/lib/access-client"
import { staffLibraryHref } from "@/lib/staff/paths"

export function LibraryContributeCta({
  documentId,
  slug,
  compact = false,
}: {
  readonly compact?: boolean
  readonly documentId: string
  readonly slug: string
}) {
  const tStatic = useTranslations("staticUi")

  const { data: session, isPending } = useHydratedSession()
  const mounted = useMounted()
  const { open } = useCorrectionDrawer()
  if (!mounted || isPending || !session?.user) return null
  const staff = (
    session.user as { staffLibraries?: { id?: string }[] }
  ).staffLibraries?.some((library) => library.id === documentId)
  if (compact)
    return staff ? (
      <a
        className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold"
        href={staffLibraryHref(slug, "/edit")}
      >
        {tStatic("common.manageRecord")}
      </a>
    ) : (
      <button
        type="button"
        className="min-h-11 rounded-full border px-4 text-sm font-semibold"
        onClick={() => open()}
      >
        {tStatic("library.improve_this_library")}
      </button>
    )

  return (
    <DashboardSidebarCta
      title={staff ? "Keep your record current" : "Know this library?"}
      body="Improve its published details. Your contribution is credited after review."
      action={
        staff
          ? {
              label: tStatic("common.manageRecord"),
              href: staffLibraryHref(slug, "/edit"),
            }
          : {
              label: tStatic("library.improve_this_library"),
              onClick: () => open(),
            }
      }
    />
  )
}
