"use client"
import { Icon } from "@iconify/react"

import type { StaffLibrarySummary } from "@/lib/access-server"
import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"

/** "Mobile library" or "Public library", for the switcher's values. */
export function libraryTypeLabel(type: string | null | undefined): string {
  return !type || type === "Other"
    ? "Library"
    : type === "Mobile"
      ? "Mobile library"
      : `${type} library`
}

/**
 * The staff area's library switcher: one stacked block with the label
 * "Your libraries (n)" above a full-width select whose value names the
 * library and its type ("Westmere Mobile Library · Mobile library"), with
 * the type's icon inside the field. Choosing one goes to its staff area.
 */
export function LibrarySwitcher({
  libraries,
  currentId,
  hrefFor,
}: {
  readonly libraries: StaffLibrarySummary[]
  readonly currentId: string
  readonly hrefFor: (id: string) => string
}) {
  const router = useRouter()
  const current = libraries.find((lib) => lib.id === currentId)
  const mobile = current?.libraryType === "Mobile"

  return (
    <label className="flex w-full flex-col gap-2 text-base font-semibold">
      Your libraries ({libraries.length})
      <span className="relative block w-full">
        <Icon
          aria-hidden="true"
          icon={mobile ? "mdi:bus-side" : "mdi:library-outline"}
          width={18}
          height={18}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          style={{ color: T.accent.ok }}
        />
        <select
          className="min-h-14 w-full appearance-none truncate rounded-[16px] border py-3 pr-10 pl-10 text-base font-semibold"
          style={{
            borderColor: T.border.hi,
            background: T.bg.deep,
            color: T.ink.base,
          }}
          value={currentId}
          onChange={(event) => router.push(hrefFor(event.target.value))}
        >
          {libraries.map((lib) => (
            <option key={lib.id} value={lib.id}>
              {lib.name} · {libraryTypeLabel(lib.libraryType)}
            </option>
          ))}
        </select>
        <Icon
          aria-hidden="true"
          icon="mdi:chevron-down"
          width={20}
          height={20}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
          style={{ color: T.ink.dim }}
        />
      </span>
    </label>
  )
}
