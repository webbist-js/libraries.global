"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import { BackLink } from "@/components/ds/BackLink"
import { Drawer } from "@/components/ds/Drawer"
import { useCapabilities, useHydratedSession } from "@/lib/access-client"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import {
  contributionPlaceParams,
  type ContributionPlace,
} from "@/lib/contribution-place"
import { T } from "@/lib/design-tokens"
import { plainDriveTitle } from "@/lib/drives/drive-view"
import type { Drive, DriveTask } from "@/lib/drives/types"

import { DriveHowToHelp } from "./DriveHowToHelp"
import { DriveTaskList } from "./DriveTaskList"
import { DriveTaskPanel } from "./DriveTaskPanel"
import { type DriveMine, DriveYourPart } from "./DriveYourPart"
import { focusChipOf } from "./focus-meta"
import {
  addSkip,
  nextTask,
  type PendingQuota,
  pointsToArchivist,
  randomTask,
  readSkips,
  type StandingTier,
  taskVerb,
} from "./task-panel.logic"

const CARD = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
  borderRadius: 32,
  padding: "clamp(20px,2.6vw,32px)",
} as const

type Point = { lat: number; lng: number }

const nameOf = (panel: HTMLElement) =>
  panel.querySelector<HTMLElement>("[data-drive-task-name]")

/**
 * An open drive's tasks on its page (spec §6.1): the task list, the task
 * editor in the shared drawer, help steps and "Your part".
 * After a send it announces "Sent for review", marks the row "In review"
 * and opens the next library, with focus on its name. Skips last for the
 * browser session. Every list and count is one page or one grouped count
 * (ADR-0004).
 */
export function DriveTaskArea({
  drive,
  initialPlace,
}: {
  readonly drive: Drive
  readonly initialPlace?: ContributionPlace
}) {
  const actor = useHydratedSession()
  const user = !actor.isPending && !actor.error ? actor.data?.user : null
  const scope = contributionAccountScope(user)

  return (
    <DriveTasksWorkspace
      key={`${drive.documentId}:${scope}:${JSON.stringify(initialPlace ?? {})}`}
      drive={drive}
      initialPlace={initialPlace}
      signedIn={Boolean(user)}
      accountScope={scope}
    />
  )
}

function DriveTasksWorkspace({
  drive,
  initialPlace,
  signedIn,
  accountScope,
}: {
  readonly drive: Drive
  readonly initialPlace?: ContributionPlace
  readonly signedIn: boolean
  readonly accountScope: string
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("drivePage")
  const placeQuery = new URLSearchParams(
    contributionPlaceParams(initialPlace ?? {})
  ).toString()

  const { claimedLibraryIds } = useCapabilities()
  const verb = taskVerb(drive.focus)
  const chip = focusChipOf(drive.focus)

  const [query, setQuery] = useState("")
  const [near, setNear] = useState<Point | null>(null)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(8)
  const [randomBusy, setRandomBusy] = useState(false)
  const picking = useRef(false)
  const skipScope = `${drive.documentId}:${accountScope}`
  const [tasks, setTasks] = useState<DriveTask[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const request = useRef(0)

  const [selected, setSelected] = useState<DriveTask | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set())
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set())
  const [announcement, setAnnouncement] = useState({ text: "", n: 0 })
  const nameRef = useRef<HTMLHeadingElement>(null)
  const focusName = useRef(false)

  const [quota, setQuota] = useState<PendingQuota | null>(null)
  const [toArchivist, setToArchivist] = useState<number | null>(null)
  const [mine, setMine] = useState<DriveMine | null>(null)
  const [mineVersion, setMineVersion] = useState(0)

  // Skips made earlier in this session.
  useEffect(() => {
    setSkipped(new Set(readSkips(skipScope)))
  }, [skipScope])

  const load = useCallback(
    async (p: number, q: string, point: Point | null) => {
      const ask = ++request.current
      setLoading(true)
      setListError(null)
      const params = new URLSearchParams(placeQuery)
      if (q) params.set("q", q)
      if (point) params.set("near", `${point.lat},${point.lng}`)
      params.set("page", String(p))
      params.set("locale", drive.locale)
      try {
        const res = await fetch(
          `/api/drives/${encodeURIComponent(drive.slug)}/tasks?${params.toString()}`
        )
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as {
          data?: DriveTask[]
          hasMore?: boolean
          total?: number
          pageSize?: number
        }
        if (ask !== request.current) return
        const data = json.data ?? []
        setTasks(data)
        setPageSize(json.pageSize ?? 8)
        setTotal(json.total ?? p * (json.pageSize ?? 8) + data.length)
        setHasMore(Boolean(json.hasMore))
        setPage(p)
      } catch {
        if (ask === request.current)
          setListError("We couldn’t load the libraries. Try again shortly.")
      } finally {
        if (ask === request.current) setLoading(false)
      }
    },
    [drive.slug, drive.locale, placeQuery]
  )

  useEffect(() => {
    void load(0, query, near)

    return () => {
      request.current += 1
    }
  }, [load, query, near])

  // The reader's quota and tier, once, and their part after each send.
  useEffect(() => {
    if (!signedIn) return
    let live = true
    fetch("/api/contribute/standing")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          json: {
            data?: StandingTier
            pendingCount?: unknown
            pendingLimit?: unknown
          } | null
        ) => {
          if (!live || !json) return
          const { data, pendingCount, pendingLimit } = json
          setQuota(
            typeof pendingCount === "number" && typeof pendingLimit === "number"
              ? { pendingCount, pendingLimit }
              : null
          )
          setToArchivist(pointsToArchivist(data ?? null))
        }
      )
      .catch(() => {})

    return () => {
      live = false
    }
  }, [signedIn])

  useEffect(() => {
    if (!signedIn) return
    let live = true
    fetch(
      `/api/drives/${encodeURIComponent(drive.slug)}/mine?locale=${encodeURIComponent(drive.locale)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: DriveMine } | null) => {
        if (live && json?.data) setMine(json.data)
      })
      .catch(() => {})

    return () => {
      live = false
    }
  }, [signedIn, drive.slug, drive.locale, mineVersion])

  // Focus the opened library's name once it's on screen.
  useEffect(() => {
    if (!focusName.current) return
    focusName.current = false
    nameRef.current?.focus()
  }, [selected, drawerOpen])

  const open = (task: DriveTask | null) => {
    setSelected(task)
    setDrawerOpen(Boolean(task))
    focusName.current = true
  }

  const announce = (text: string) =>
    setAnnouncement((a) => ({ text, n: a.n + 1 }))

  const onSent = (task: DriveTask) => {
    const nowDone = new Set(done).add(task.documentId)
    setDone(nowDone)
    announce("Sent for review")
    setQuota((q) => q && { ...q, pendingCount: q.pendingCount + 1 })
    setMineVersion((v) => v + 1)
    const next = nextTask(tasks, task.documentId, skipped, nowDone)
    if (next) void selectRow(next)
    else open(null)
  }

  const onSkip = (task: DriveTask) => {
    if (signedIn) {
      fetch(
        `/api/drives/${encodeURIComponent(drive.slug)}/holds/${encodeURIComponent(task.documentId)}?locale=${encodeURIComponent(drive.locale)}`,
        { method: "DELETE" }
      ).catch(() => {})
    }
    const nowSkipped = new Set(addSkip(skipScope, task.documentId))
    setSkipped(nowSkipped)
    const next = nextTask(tasks, task.documentId, nowSkipped, done)
    if (next) void selectRow(next)
    else open(null)
  }

  // "Give me a library": signed in, a held pick from the server; signed
  // out, D1's random pick from what's already on screen.
  const onRandom = async () => {
    if (picking.current) return
    if (!signedIn) {
      const pick = randomTask(tasks, skipped, done)
      if (pick) open(pick)
      else announce("Every library shown is done, skipped or in review.")

      return
    }
    picking.current = true
    setRandomBusy(true)
    try {
      const res = await fetch(
        `/api/drives/${encodeURIComponent(drive.slug)}/next`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skip: [...skipped],
            q: query,
            near: near ? `${near.lat},${near.lng}` : undefined,
            locale: drive.locale,
            place: Object.fromEntries(new URLSearchParams(placeQuery)),
          }),
        }
      )
      const json = (await res.json().catch(() => ({}))) as {
        data?: DriveTask | null
        message?: string
        error?: string
      }
      if (!res.ok) {
        announce(json.error ?? "We couldn’t get a library. Try again shortly.")

        return
      }
      if (json.data) {
        const task = json.data
        open(task)
        announce("Here’s a library. It’s kept for you for 20 minutes.")
      } else {
        announce(
          json.message ?? "Every library left is in review, held or skipped."
        )
      }
    } catch {
      announce("We couldn’t get a library. Try again shortly.")
    } finally {
      picking.current = false
      setRandomBusy(false)
    }
  }

  // Picking a row by hand: a signed-in reader holds it first, the same as
  // "Give me a library" (decision 2). A 409 marks the row held by someone
  // else and keeps the current selection; any other failure still opens
  // it — a hold is a courtesy, not a gate.
  const selectRow = async (task: DriveTask) => {
    if (!signedIn) {
      open(task)

      return
    }
    try {
      const res = await fetch(
        `/api/drives/${encodeURIComponent(drive.slug)}/holds`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ libraryDocumentId: task.documentId }),
        }
      )
      if (res.status === 409) {
        setTasks((prev) =>
          prev.map((t) =>
            t.documentId === task.documentId ? { ...t, heldByOther: true } : t
          )
        )
        announce("Someone’s on this library. Pick another.")

        return
      }
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          data?: { expiresAt?: unknown }
        }
        const expiresAt = json.data?.expiresAt

        open({
          ...task,
          heldUntil: typeof expiresAt === "string" ? expiresAt : null,
        })

        return
      }
      open(task)
    } catch {
      open(task)
    }
  }

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const panel = selected ? (
    <DriveTaskPanel
      key={selected.documentId}
      claimed={claimedLibraryIds.includes(selected.documentId)}
      drive={drive}
      heldUntil={selected.heldUntil}
      nameRef={nameRef}
      onSent={onSent}
      onSkip={onSkip}
      quota={quota}
      returnTo={`${drive.locale === "en" ? "" : `/${drive.locale}`}/community/drives/${drive.slug}${placeQuery ? `?${placeQuery}` : ""}`}
      signedIn={signedIn}
      task={selected}
    />
  ) : null

  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="drive-tasks-heading"
          className="flex min-w-0 flex-col gap-4"
          style={CARD}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 id="drive-tasks-heading" className="type-h2 m-0">
                {t("pickLibrary")}
              </h2>
              <BackLink
                href="/community#drives"
                icon="chevron"
                className="shrink-0 text-base text-(--t-ink-dim) [&_svg]:size-4"
              >
                {t("backToDrives")}
              </BackLink>
            </div>
            <p className="m-0 max-w-[70ch] text-base leading-relaxed text-(--t-ink-dim)">
              {t("taskIntro")}
            </p>
          </div>
          <div
            aria-label={tUi("drive_updates")}
            role="status"
            className={
              announcement.text
                ? "text-sm font-semibold text-(--t-ink-base)"
                : "sr-only"
            }
          >
            {announcement.text ? (
              <span
                key={announcement.n}
                className="inline-flex items-center gap-2"
              >
                <Icon aria-hidden icon="mdi:information-outline" width={17} />
                {announcement.text}
              </span>
            ) : null}
          </div>
          <DriveTaskList
            doneIds={done}
            error={listError}
            hasMore={hasMore}
            loading={loading}
            near={near !== null}
            page={page}
            pageSize={pageSize}
            total={total}
            onPage={(p) => void load(p, query, near)}
            onNear={setNear}
            onSearch={setQuery}
            onSelect={(task) => void selectRow(task)}
            query={query}
            selectedId={drawerOpen ? (selected?.documentId ?? null) : null}
            tasks={tasks}
            verb={verb}
            icon={chip.icon}
          />
        </section>
        <div className="flex min-w-0 flex-col gap-3">
          <DriveHowToHelp
            drive={drive}
            onRandom={() => void onRandom()}
            busy={randomBusy}
            disabled={loading}
          />
          {signedIn ? (
            <DriveYourPart
              mine={mine}
              quota={quota}
              toArchivist={toArchivist}
            />
          ) : null}
        </div>
      </div>
      {drawerOpen && panel ? (
        <Drawer
          icon={{ name: chip.icon, bg: chip.tint.bg, fg: chip.tint.fg }}
          initialFocus={nameOf}
          onClose={closeDrawer}
          subtitle={plainDriveTitle(drive.title)}
          title={verb}
          titleId="drive-task-drawer-title"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            <p
              role="status"
              aria-label={tUi("drive_updates")}
              className={
                announcement.text
                  ? "mt-0 mb-4 text-sm font-semibold text-(--t-ink-base)"
                  : "sr-only"
              }
            >
              {announcement.text}
            </p>
            {panel}
          </div>
        </Drawer>
      ) : null}
    </>
  )
}
