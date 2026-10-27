"use client"
import { Icon } from "@iconify/react"
import type { PublicLiveState } from "@repo/shared-data"
import { useEffect, useState } from "react"

import { T } from "@/lib/design-tokens"
import type { LiveSettingsResponse } from "@/lib/mobile-live/types"
import type { StaffTeam } from "@/lib/staff/types"

import { ConsolePreview } from "./ConsolePreview"
import { GoLiveToday } from "./GoLiveToday"
import { registerLiveIcons } from "./icons"
import { LivePrivacyCard } from "./LivePrivacyCard"
import { LiveSessionsTable, type SessionLog } from "./LiveSessionsTable"
import { LiveSharingSettings } from "./LiveSharingSettings"

registerLiveIcons()

export type { SessionLog } from "./LiveSessionsTable"

/**
 * The Go live tab: today's route and the way into the console, the console
 * preview, the sharing settings with the sessions log, and the privacy
 * card. The public live state is polled here and shared with the parts.
 */
export function LiveSettings({
  initial,
  owner,
  team,
  members,
  logs,
  locale,
  consoleUrl,
  publicPath,
  firstName,
  learnMoreHref,
}: {
  readonly initial: LiveSettingsResponse
  readonly owner: boolean
  readonly team: boolean
  readonly members: StaffTeam
  readonly logs: SessionLog[]
  readonly locale: string
  readonly consoleUrl: string
  readonly publicPath: string
  readonly firstName: string
  /** "Going live from your phone" in Knowledge, when the page resolves it. */
  readonly learnMoreHref?: string
}) {
  const id = initial.library.id,
    [live, setLive] = useState<PublicLiveState | null>(null),
    [note, setNote] = useState<{ tone: "ok" | "danger"; text: string } | null>(
      null
    )
  useEffect(() => {
    let cancelled = false
    const poll = () => {
      if (document.visibilityState !== "visible") return
      fetch(`/api/mobile/live?ids=${id}`)
        .then((r) => r.json())
        .then((v) => {
          if (!cancelled) setLive(v.states?.[0] ?? null)
        })
        .catch(() => {})
    }
    poll()
    const t = setInterval(poll, 30_000)

    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [id])

  return (
    <div className="flex flex-col gap-8">
      <GoLiveToday
        initial={initial}
        live={live}
        locale={locale}
        consoleUrl={consoleUrl}
        learnMoreHref={learnMoreHref}
      />
      <ConsolePreview
        initial={initial}
        live={live}
        publicPath={publicPath}
        firstName={firstName}
      />
      <section aria-labelledby="live-sharing-heading">
        <h2 id="live-sharing-heading" className="type-h2 m-0">
          Live sharing settings
        </h2>
        <p className="m-0 mt-1 mb-5 text-base" style={{ color: T.ink.dim }}>
          For claimants of {initial.library.name}.
        </p>
        {note ? (
          <p
            role={note.tone === "danger" ? "alert" : "status"}
            className="mb-4 flex items-center gap-2 text-sm"
            style={{
              color: note.tone === "danger" ? T.accent.danger : T.accent.ok,
            }}
          >
            <Icon
              aria-hidden="true"
              icon={
                note.tone === "danger"
                  ? "mdi:alert-circle-outline"
                  : "mdi:check-circle-outline"
              }
              width={16}
            />
            {note.text}
          </p>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <LiveSharingSettings
              initial={initial}
              owner={owner}
              team={team}
              members={members}
              onNote={setNote}
            />
            <LiveSessionsTable
              logs={logs}
              timezone={initial.library.timezone}
            />
          </div>
          <LivePrivacyCard libraryDocumentId={id} />
        </div>
      </section>
    </div>
  )
}
