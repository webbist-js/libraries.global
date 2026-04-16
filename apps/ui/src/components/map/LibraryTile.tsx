"use client"

import { buildLibraryPath, type LibrarySearchHit } from "@/lib/meilisearch"
import { Link } from "@/lib/navigation"
import { cn } from "@/lib/styles"

const STATUS_STYLES: Record<string, string> = {
  open: "text-emerald-400 bg-emerald-500/12",
  temporarily_closed: "text-amber-400 bg-amber-500/12",
  permanently_closed: "text-red-400 bg-red-500/12",
  seasonal: "text-sky-400 bg-sky-500/12",
  appointment_only: "text-purple-400 bg-purple-500/12",
  planned: "text-blue-400 bg-blue-500/12",
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  temporarily_closed: "Closed",
  permanently_closed: "Closed",
  seasonal: "Seasonal",
  appointment_only: "By Appt.",
  planned: "Planned",
  unknown: "Unknown",
}

interface LibraryTileProps {
  hit: LibrarySearchHit
  className?: string
}

export default function LibraryTile({ hit, className }: LibraryTileProps) {
  const href = buildLibraryPath(hit)
  const statusStyle =
    STATUS_STYLES[hit.operationalStatus ?? ""] ?? "text-white/30 bg-white/8"
  const statusLabel = STATUS_LABELS[hit.operationalStatus ?? ""] ?? "Unknown"
  const location = [hit.city, hit.country_name].filter(Boolean).join(", ")

  const card = (
    <div
      className={cn(
        "group flex w-52 flex-shrink-0 flex-col gap-2 rounded-xl border border-white/8 bg-[#080d1c] p-3.5 transition-colors",
        href && "cursor-pointer hover:border-indigo-500/40 hover:bg-[#0d1429]",
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-medium tracking-wider text-white/35 uppercase">
          {hit.libraryType ?? "Library"}
        </span>
        {hit.operationalStatus && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              statusStyle
            )}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {/* Name */}
      <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-white group-hover:text-indigo-200">
        {hit.name}
      </h3>

      {/* Location */}
      {location && (
        <p className="mt-auto text-[11px] text-white/40">{location}</p>
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{card}</Link>
  }

  return card
}
