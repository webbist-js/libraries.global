"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import { Drawer } from "@/components/ds/Drawer"
import { useCapabilities } from "@/lib/access-client"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { plainDriveTitle } from "@/lib/drives/drive-view"
import type { Drive, DriveTask } from "@/lib/drives/types"

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

/** The panel sits beside the list from Tailwind's `lg` up; below, a drawer. */
const WIDE_QUERY = "(min-width: 1024px)"

const CARD = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
  borderRadius: 24,
  padding: "clamp(20px,2.6vw,28px)",
} as const

type Point = { lat: number; lng: number }

/** Whether the screen is wide enough for the side column. */
function useWide(): boolean {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const mq = globalThis.matchMedia?.(WIDE_QUERY)
    if (!mq) return
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener?.("change", update)

    return () => mq.removeEventListener?.("change", update)
  }, [])

  return wide
}

const nameOf = (panel: HTMLElement) =>
  panel.querySelector<HTMLElement>("[data-drive-task-name]")

/**
 * An open drive's tasks on its page (spec §6.1): the task list, the task
 * panel beside it on wide screens (a drawer below `lg`), and "Your part".
 * After a send it announces "Sent for review", marks the row "In review"
 * and opens the next library, with focus on its name. Skips last for the
 * browser session. Every list and count is one page or one grouped count
 * (ADR-0004).
 */
export function DriveTaskArea({ drive }: { readonly drive: Drive }) {
  const tUi = useUiTranslations("ui")

  const { data: session, isPending } = authClient.useSession()
  const signedIn = Boolean(session?.user)
  const { claimedLibraryIds } = useCapabilities()
  const wide = useWide()
  const verb = taskVerb(drive.focus)
  const chip = focusChipOf(drive.focus)

  const [query, setQuery] = useState("")
  const [near, setNear] = useState<Point | null>(null)
  const [page, setPage] = useState(0)
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
    setSkipped(new Set(readSkips(drive.documentId)))
  }, [drive.documentId])

  const load = useCallback(
    async (p: number, q: string, point: Point | null) => {
      const ask = ++request.current
      setLoading(true)
      setListError(null)
      const params = new URLSearchParams()
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
        }
        if (ask !== request.current) return
        const data = json.data ?? []
        setTasks((prev) => {
          if (p === 0) return data
          const seen = new Set(prev.map((t) => t.documentId))

          return [...prev, ...data.filter((t) => !seen.has(t.documentId))]
        })
        setHasMore(Boolean(json.hasMore))
        setPage(p)
      } catch {
        if (ask === request.current)
          setListError("We couldn’t load the libraries. Try again shortly.")
      } finally {
        if (ask === request.current) setLoading(false)
      }
    },
    [drive.slug, drive.locale]
  )

  useEffect(() => {
    void load(0, query, near)
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
    open(nextTask(tasks, task.documentId, skipped, nowDone))
  }

  const onSkip = (task: DriveTask) => {
    if (signedIn) {
      fetch(
        `/api/drives/${encodeURIComponent(drive.slug)}/holds/${encodeURIComponent(task.documentId)}?locale=${encodeURIComponent(drive.locale)}`,
        { method: "DELETE" }
      ).catch(() => {})
    }
    const nowSkipped = new Set(addSkip(drive.documentId, task.documentId))
    setSkipped(nowSkipped)
    open(nextTask(tasks, task.documentId, nowSkipped, done))
  }

  // "Give me a library": signed in, a held pick from the server; signed
  // out, D1's random pick from what's already on screen.
  const onRandom = async () => {
    if (!signedIn) {
      const pick = randomTask(tasks, skipped, done)
      if (pick) open(pick)
      else announce("Every library shown is done, skipped or in review.")

      return
    }
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
        setTasks((prev) =>
          prev.some((t) => t.documentId === task.documentId)
            ? prev
            : [task, ...prev]
        )
        open(task)
        announce("Here’s a library. It’s kept for you for 20 minutes.")
      } else {
        announce(
          json.message ?? "Every library left is in review, held or skipped."
        )
      }
    } catch {
      announce("We couldn’t get a library. Try again shortly.")
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
      signedIn={signedIn}
      task={selected}
    />
  ) : null

  return (
    <>
      <section
        aria-labelledby="drive-tasks-heading"
        className="flex flex-col gap-5"
        style={CARD}
      >
        <div className="flex flex-col gap-1.5">
          <h2
            id="drive-tasks-heading"
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(26px,2.6vw,32px)",
              color: T.ink.base,
            }}
          >
            Pick a library
          </h2>
          <p
            className="m-0 text-[15px] leading-[1.55]"
            style={{ color: T.ink.dim }}
          >
            Most complete first, so each one is quick to finish. Every change
            goes to a reviewer, as anywhere on the site.
          </p>
        </div>

        <div
          aria-label={tUi("drive_updates")}
          className="min-h-0"
          role="status"
          style={{ color: T.accent.ok }}
        >
          {announcement.text ? (
            <span
              key={announcement.n}
              className="inline-flex items-center gap-2 text-[15px] font-semibold"
            >
              <Icon
                aria-hidden="true"
                height={18}
                icon="mdi:check-circle-outline"
                width={18}
              />
              {announcement.text}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
          <DriveTaskList
            doneIds={done}
            error={listError}
            hasMore={hasMore}
            loading={loading}
            near={near !== null}
            onMore={() => void load(page + 1, query, near)}
            onNear={setNear}
            onRandom={() => void onRandom()}
            onSearch={setQuery}
            onSelect={(task) => void selectRow(task)}
            query={query}
            selectedId={selected?.documentId ?? null}
            tasks={tasks}
            verb={verb}
          />
          {wide ? (
            <div
              // Hidden by CSS below lg too, so a phone's first paint (before
              // the media query is read) never shows the side column.
              className="hidden flex-col rounded-[20px] border p-5 lg:sticky lg:top-24 lg:flex"
              style={{ background: T.bg.void, borderColor: T.border.line }}
            >
              {panel ?? (
                <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
                  {isPending || signedIn
                    ? "Pick a library from the list, or press “Give me a library”."
                    : "Pick a library to see what it needs. You’ll be asked to sign in before you send anything."}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {!wide && drawerOpen && panel ? (
        <Drawer
          icon={{ name: chip.icon, bg: chip.tint.bg, fg: chip.tint.fg }}
          initialFocus={nameOf}
          onClose={closeDrawer}
          subtitle={plainDriveTitle(drive.title)}
          title={verb}
          titleId="drive-task-drawer-title"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            {panel}
          </div>
        </Drawer>
      ) : null}

      {signedIn ? (
        <DriveYourPart mine={mine} quota={quota} toArchivist={toArchivist} />
      ) : null}
    </>
  )
}
