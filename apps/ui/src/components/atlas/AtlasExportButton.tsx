"use client"

import { useId, useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEntitlements } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { MAX_EXPORT_IDS } from "@/lib/export-format"

import { Icon } from "./atlas-ui"
import type { AtlasLibrary } from "./atlas.logic"

export type ExportFormat = "csv" | "geojson"

const FORMATS: { value: ExportFormat; label: string; sub: string }[] = [
  { value: "csv", label: "CSV", sub: "For spreadsheets" },
  { value: "geojson", label: "GeoJSON", sub: "For maps and GIS tools" },
]

const BUTTON =
  "inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3.5 text-[14px] font-semibold disabled:opacity-40"

type Outcome = { tone: "ok" | "error"; text: string }

const narrow = "Zoom in or add a filter to narrow the list."

async function failureText(res: Response): Promise<string> {
  if (res.status === 401) return "Your session has ended. Sign in to export."
  if (res.status === 413) {
    const { limit } = (await res.json().catch(() => ({}))) as {
      limit?: unknown
    }
    if (typeof limit === "number")
      return `Your plan exports up to ${limit.toLocaleString()} libraries at a time. ${narrow}`
  }

  return "The export didn’t finish. Try again in a moment."
}

function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  // Revoking straight away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Posts the listed ids and saves the file. The server re-checks Pro. */
export function useAtlasExport(onUpgrade: () => void) {
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const run = async (format: ExportFormat, ids: string[]) => {
    if (ids.length > MAX_EXPORT_IDS) {
      setOutcome({
        tone: "error",
        text: `One export holds up to ${MAX_EXPORT_IDS.toLocaleString()} libraries. ${narrow}`,
      })

      return
    }
    setBusy(true)
    setOutcome(null)
    try {
      const res = await fetch("/api/export/atlas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, ids }),
      })
      if (res.status === 402) {
        onUpgrade()

        return
      }
      if (!res.ok) {
        setOutcome({ tone: "error", text: await failureText(res) })

        return
      }
      const name = /filename="([^"]+)"/.exec(
        res.headers.get("content-disposition") ?? ""
      )?.[1]
      saveFile(await res.blob(), name ?? `libraries-global-atlas.${format}`)
      setOutcome({ tone: "ok", text: "Your export is downloading." })
    } catch {
      setOutcome({
        tone: "error",
        text: "The export didn’t finish. Check your connection and try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  return { busy, outcome, run }
}

/**
 * Exports the libraries in the list, in its order. Pro members get a CSV or
 * GeoJSON menu; everyone else gets a locked "Export · Pro" button, which
 * opens the plans sheet. The lock only explains: the route enforces it.
 */
export function AtlasExportButton({
  libraries,
  onSeePlans,
}: {
  readonly libraries: AtlasLibrary[]
  readonly onSeePlans: () => void
}) {
  const { can, ready } = useEntitlements()
  const { busy, outcome, run } = useAtlasExport(onSeePlans)
  const [open, setOpen] = useState(false)
  const noteId = useId()
  const style = { borderColor: T.border.hi, color: T.ink.base }

  // Neutral until the session loads, so Pro members never see the lock flash.
  if (!ready)
    return (
      <button type="button" disabled className={BUTTON} style={style}>
        <Icon name="download" size={16} />
        Export
      </button>
    )

  if (!can("atlas.export"))
    return (
      <>
        <button
          type="button"
          onClick={onSeePlans}
          aria-describedby={noteId}
          className={BUTTON}
          style={style}
        >
          <Icon name="lock" size={16} />
          Export · Pro
        </button>
        <p
          id={noteId}
          className="order-last m-0 basis-full text-[14px]"
          style={{ color: T.ink.dim }}
        >
          Export is a Pro feature.
        </p>
      </>
    )

  const error = outcome?.tone === "error"

  return (
    <>
      <DropdownMenu open={open} onOpenChange={(o) => setOpen(o && !busy)}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-busy={busy}
            disabled={libraries.length === 0}
            className={BUTTON}
            style={style}
          >
            <Icon name="download" size={16} />
            {busy ? "Exporting…" : "Export"}
            <Icon name="chevD" size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[240px] rounded-[20px] border p-2 shadow-none"
          style={{
            background: T.bg.deep,
            borderColor: T.border.line,
            boxShadow: "0 12px 28px rgba(23,22,43,.08)",
          }}
        >
          {FORMATS.map((f) => (
            <DropdownMenuItem
              key={f.value}
              onSelect={() =>
                void run(
                  f.value,
                  libraries.map((l) => l.id)
                )
              }
              className="cursor-pointer flex-col items-start gap-0 rounded-[12px] px-2.5 py-2 focus:bg-(--t-bg-muted-2) focus:text-(--t-ink-base)"
            >
              <span className="text-[15px] font-semibold">{f.label}</span>
              <span className="text-[13px]" style={{ color: T.ink.dim }}>
                {f.sub}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Always mounted so screen readers hear each outcome; only errors show. */}
      <p
        role="status"
        className={
          error
            ? "order-last m-0 flex basis-full items-center gap-1.5 text-[14px] font-semibold"
            : "sr-only"
        }
        style={error ? { color: T.accent.danger } : undefined}
      >
        {error ? <Icon name="warn" size={16} /> : null}
        {outcome?.text}
      </p>
    </>
  )
}
