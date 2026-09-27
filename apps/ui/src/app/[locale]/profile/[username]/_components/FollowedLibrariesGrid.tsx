import { T, tintForLibraryType } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

// ── FollowedLibrariesGrid ────────────────────────────────────────────────────
//
// Light v2 library cards (white card, photo or type-tinted monogram, serif
// name, type pill, place line). Accepts followed or claimed libraries.
//
// variant="grid" (alias "carousel") — full responsive grid. FollowingSection.
// variant="compact" — tighter 2–3 col grid, up to `max` cards + "See all" link.

export type ProfileLibraryItem = {
  documentId?: string | null
  name: string | null
  slug: string | null
  libraryType?: string | null
  heroImageUrl?: string | null
  /** Atlas path (/continent/country/region/slug) */
  path?: string | null
}

function initialsOf(name: string): string {
  const words = name
    .replaceAll(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(of|the|and|de|la|le|du|des)$/i.test(w))

  return (
    words
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  )
}

function titleizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ")
}

/** "Region, Country" derived from the atlas path, when present. */
function placeFromPath(path?: string | null): string | null {
  if (!path) return null
  const segs = path.split("/").filter(Boolean)
  // [continent, country, region, library]
  if (segs.length < 3) return null
  const country = segs[1]
  const region = segs.length >= 4 ? segs[2] : null

  return [region, country]
    .filter((s): s is string => !!s)
    .map(titleizeSlug)
    .join(", ")
}

function LibraryTile({
  lib,
  compact,
  roleLabel,
}: {
  lib: ProfileLibraryItem
  compact: boolean
  roleLabel?: string
}) {
  const name = lib.name ?? lib.slug ?? "Untitled library"
  const tint = tintForLibraryType(lib.libraryType)
  const img = formatStrapiMediaUrl(lib.heroImageUrl) ?? null
  const place = placeFromPath(lib.path)

  const body = (
    <>
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: compact ? "16 / 9" : "16 / 10",
          background: img ? T.bg.muted : tint.bg,
          borderBottom: `1px solid ${T.border.divider}`,
        }}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-full items-center justify-center"
            style={{
              fontFamily: T.font.serif,
              fontSize: compact ? "32px" : "44px",
              fontWeight: 500,
              color: tint.fg,
            }}
          >
            {initialsOf(name)}
          </span>
        )}
      </div>
      <div
        className={
          compact ? "flex flex-col gap-1.5 p-3.5" : "flex flex-col gap-2 p-4"
        }
      >
        <p
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontSize: compact ? "17px" : "20px",
            fontWeight: 500,
            lineHeight: 1.25,
            color: T.ink.base,
          }}
        >
          {name}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {lib.libraryType ? (
            <span
              className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
              style={{ background: tint.bg, color: tint.fg }}
            >
              {lib.libraryType}
            </span>
          ) : null}
          {roleLabel ? (
            <span
              className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
              style={{
                background: "var(--tint-public-bg)",
                color: "var(--tint-public-fg)",
              }}
            >
              {roleLabel}
            </span>
          ) : null}
        </div>
        {place ? (
          <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
            {place}
          </p>
        ) : null}
      </div>
    </>
  )

  const className =
    "flex h-full flex-col overflow-hidden rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) no-underline transition-[border-color,box-shadow] duration-150"

  return (
    <li className="min-w-0">
      {lib.path ? (
        <Link
          href={lib.path}
          className={`${className} hover:border-(--t-border-hi) hover:shadow-[0_12px_28px_rgba(23,22,43,.08)]`}
        >
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  )
}

export function FollowedLibrariesGrid({
  libraries,
  username,
  variant = "compact",
  max,
  roleLabel,
  emptyState,
}: {
  libraries: ProfileLibraryItem[]
  username: string
  variant?: "compact" | "grid" | "carousel"
  max?: number
  /** Optional pill shown on every card, e.g. "Steward". */
  roleLabel?: string
  /** Replaces the default "Not following any libraries yet." message. */
  emptyState?: React.ReactNode
}) {
  const compact = variant === "compact"
  const items = max ? libraries.slice(0, max) : libraries

  if (libraries.length === 0) {
    return (
      emptyState ?? (
        <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
          Not following any libraries yet.{" "}
          <Link
            href="/libraries"
            className="font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
            style={{ color: T.accent.primary }}
          >
            Find libraries
          </Link>
        </p>
      )
    )
  }

  return (
    <div>
      <ul
        className={
          compact
            ? "m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-3"
            : "m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3"
        }
      >
        {items.map((lib, index) => (
          <LibraryTile
            key={lib.documentId ?? lib.slug ?? String(index)}
            lib={lib}
            compact={compact}
            roleLabel={roleLabel}
          />
        ))}
      </ul>
      {max && libraries.length > max ? (
        <p className="m-0 mt-3 text-right">
          <Link
            href={`/profile/${username}/following`}
            className="text-[15px] font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
            style={{ color: T.accent.primary }}
          >
            See all {libraries.length}
          </Link>
        </p>
      ) : null}
    </div>
  )
}
