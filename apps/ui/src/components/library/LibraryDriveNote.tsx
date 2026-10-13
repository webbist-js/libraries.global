"use client"

import { useLocale } from "next-intl"
import { type ReactNode, useEffect, useState } from "react"

import { FeaturedContribution } from "@/components/contribute/FeaturedContribution"
import { hubHref } from "@/components/contribute/wizard.logic"
import { DriveTaskPanel } from "@/components/drives/DriveTaskPanel"
import { DriveTitle } from "@/components/drives/DriveTitle"
import { focusChipOf } from "@/components/drives/focus-meta"
import {
  taskActionName,
  taskVerb,
  type PendingQuota,
} from "@/components/drives/task-panel.logic"
import { Drawer } from "@/components/ds/Drawer"
import { useCapabilities } from "@/lib/access-client"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { driveHref, plainDriveTitle } from "@/lib/drives/drive-view"
import type { DriveFocus, DriveTask, DriveUnit } from "@/lib/drives/types"
import { Link } from "@/lib/navigation"

export type LibraryDriveRef = {
  documentId: string
  slug: string
  name: string
  city?: string | null
  regionName?: string | null
  website?: string | null
  libraryType?: string | null
  href: string
}

type ForLibraryDrive = {
  documentId: string
  slug: string
  title: string
  focus: DriveFocus
  unit: DriveUnit
  done: number
  total: number
}

const fmt = (n: number) => n.toLocaleString("en-GB")

/**
 * "Part of *{drive}* · n of m done": the open drive this library's own page
 * belongs to, with a pill that opens its task panel on just this library.
 * The library page is `force-static`, so this fetches the drive client-side
 * (`GET /api/drives/for-library/[documentId]`) and shows nothing when the
 * library isn't in one.
 */
export function LibraryDriveNote({
  library,
  featured = false,
  fallback = null,
}: {
  readonly featured?: boolean
  readonly fallback?: ReactNode
  readonly library: LibraryDriveRef
}) {
  const locale = useLocale()
  const { data: session } = authClient.useSession()
  const signedIn = Boolean(session?.user)
  const { claimedLibraryIds } = useCapabilities()

  const [drive, setDrive] = useState<ForLibraryDrive | null>(null)
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [quota, setQuota] = useState<PendingQuota | null>(null)
  const [announcement, setAnnouncement] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetch(
      `/api/drives/for-library/${encodeURIComponent(library.documentId)}?locale=${encodeURIComponent(locale)}`,
      { signal: controller.signal }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: ForLibraryDrive | null } | null) => {
        if (!controller.signal.aborted) setDrive(json?.data ?? null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setDrive(null)
      })

    return () => controller.abort()
  }, [library.documentId, locale])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetch("/api/contribute/standing", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (json: { pendingCount?: unknown; pendingLimit?: unknown } | null) => {
          if (controller.signal.aborted || !json) return
          const { pendingCount, pendingLimit } = json
          setQuota(
            typeof pendingCount === "number" && typeof pendingLimit === "number"
              ? { pendingCount, pendingLimit }
              : null
          )
        }
      )
      .catch(() => {})

    return () => controller.abort()
  }, [open])

  if (!drive || hidden) return fallback

  const chip = focusChipOf(drive.focus)
  const verb =
    library.libraryType === "Mobile" && taskVerb(drive.focus) === "Add hours"
      ? "Add stops and times"
      : taskVerb(drive.focus)
  const actionName = taskActionName(verb, "this library")

  const task: DriveTask = {
    documentId: library.documentId,
    slug: library.slug,
    name: library.name,
    city: library.city,
    region_name: library.regionName,
    website: library.website,
    href: library.href,
    inReview: false,
  }

  return (
    <>
      {featured ? (
        <FeaturedContribution
          title={plainDriveTitle(drive.title)}
          description={`Help with this library's task. ${fmt(drive.done)} of ${fmt(drive.total)} tasks have been accepted across the drive.`}
          action={
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-h-12 rounded-full px-5 text-sm font-semibold text-white"
              style={{ background: T.accent.primary }}
            >
              {actionName}
            </button>
          }
          alternatives={[
            {
              title: "View the drive",
              href: driveHref(drive.slug),
              description: "See the goal and accepted progress.",
            },
            {
              title: "Suggest a correction",
              href: hubHref("correction", library),
              description: "Send another changed detail with a source.",
            },
            {
              title: "Share a photo",
              href: hubHref("photo", library),
              description: "Use your own or an openly licensed photo.",
            },
          ]}
        />
      ) : (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
          style={{ background: T.accent.chip }}
        >
          <p className="m-0 min-w-0 text-[14px]" style={{ color: T.ink.base }}>
            Part of{" "}
            <Link
              href={driveHref(drive.slug)}
              className="font-semibold underline underline-offset-2"
              style={{ color: T.accent.primaryHover, fontFamily: T.font.serif }}
            >
              <DriveTitle title={drive.title} />
            </Link>{" "}
            · {fmt(drive.done)} of {fmt(drive.total)} done
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border bg-white px-4 text-[13.5px] font-semibold"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            {actionName}
          </button>
        </div>
      )}

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {open ? (
        <Drawer
          icon={{ name: chip.icon, bg: chip.tint.bg, fg: chip.tint.fg }}
          onClose={() => setOpen(false)}
          subtitle={plainDriveTitle(drive.title)}
          title={verb}
          titleId="library-drive-task-title"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            <DriveTaskPanel
              claimed={claimedLibraryIds.includes(library.documentId)}
              drive={{
                documentId: drive.documentId,
                slug: drive.slug,
                focus: drive.focus,
              }}
              onSent={() => {
                setAnnouncement("Sent for review")
                setOpen(false)
                setHidden(true)
              }}
              onSkip={() => setOpen(false)}
              quota={quota}
              signedIn={signedIn}
              task={task}
            />
          </div>
        </Drawer>
      ) : null}
    </>
  )
}
