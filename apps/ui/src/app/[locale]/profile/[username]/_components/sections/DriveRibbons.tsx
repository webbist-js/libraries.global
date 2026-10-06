"use client"

import { useEffect, useState } from "react"

import type { DriveRibbon } from "@/app/api/profile/[username]/drives/route"
import { Badge } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { driveHref } from "@/lib/drives/drive-view"
import { Link } from "@/lib/navigation"

import { CARD, SectionTitle } from "../ProfileSectionUI"

/** A drive's status, as "Finished" / "Open" / "Closed" — icon + text, never colour alone. */
function StatusPill({ drive }: { readonly drive: DriveRibbon }) {
  if (drive.goalMet)
    return <Badge label="Finished" color="ok" icon="mdi:flag-checkered" />
  if (drive.status === "open")
    return <Badge label="Open" color="aurora" icon="mdi:progress-check" />

  return <Badge label="Closed" color="dim" icon="mdi:check" />
}

/**
 * The Drives a person has helped with: a title, their accepted task count
 * and a status pill, most recently credited first. Renders nothing when the
 * list is empty — Strapi already hides it from others when activity isn't
 * public.
 */
export function DriveRibbons({ username }: { readonly username: string }) {
  const [drives, setDrives] = useState<DriveRibbon[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(username)}/drives`)
      .then((r) => r.json())
      .then((json: { data?: DriveRibbon[] }) => {
        setDrives(json.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [username])

  if (!loaded || drives.length === 0) return null

  return (
    <section
      aria-labelledby="rc-drives"
      style={{ ...CARD, padding: "20px 24px 24px" }}
    >
      <div className="flex items-baseline justify-between gap-2 pb-4">
        <SectionTitle as="h2" id="rc-drives">
          Drives
        </SectionTitle>
        <span className="text-[15px]" style={{ color: T.ink.dim }}>
          {drives.length} {drives.length === 1 ? "drive" : "drives"}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {drives.map((drive) => (
          <li
            key={drive.documentId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-4 py-3"
            style={{ background: T.bg.surface }}
          >
            <div className="min-w-0">
              <Link
                href={driveHref(drive.slug)}
                className="block truncate font-semibold no-underline hover:underline"
                style={{ color: T.ink.base }}
              >
                {drive.title}
              </Link>
              <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
                {drive.tasks} accepted {drive.tasks === 1 ? "task" : "tasks"}
              </p>
            </div>
            <StatusPill drive={drive} />
          </li>
        ))}
      </ul>
    </section>
  )
}
