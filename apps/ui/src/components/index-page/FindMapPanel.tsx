// apps/ui/src/components/index-page/FindMapPanel.tsx
"use client"

import { T } from "@/lib/design-tokens"
import type { LibrarySearchHitV2 } from "@/lib/meilisearch"
import { Link } from "@/lib/navigation"

/**
 * Map-view side panel. The full interactive globe lives at /map — here we
 * show a lightweight sticky panel with a link out plus an accessible
 * "map as text" listing of the current results' coordinates.
 */
export function FindMapPanel({ hits }: { hits: LibrarySearchHitV2[] }) {
  const withGeo = hits.filter((h) => h._geo)

  return (
    <aside
      className="sticky top-[90px] flex min-h-[420px] flex-col gap-4 p-6"
      style={{
        background: "var(--tint-academic-bg)",
        border: `1px dashed #D3DEEB`,
        borderRadius: 20,
        color: "var(--tint-academic-fg)",
      }}
      aria-label="Map of results"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
        <p className="m-0 text-[17px] font-semibold">
          {withGeo.length} of {hits.length} results have map coordinates
        </p>
        <Link
          href="/map"
          className="rounded-full px-5 py-2.5 text-[15px] font-semibold text-white no-underline"
          style={{ background: T.accent.primary }}
        >
          Open the full map
        </Link>
      </div>

      {withGeo.length > 0 ? (
        <details className="text-left">
          <summary
            className="cursor-pointer text-[15px] font-semibold"
            style={{ color: T.ink.base }}
          >
            Map as text
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {withGeo.slice(0, 30).map((h) => (
              <li
                key={h.documentId}
                className="flex items-baseline justify-between gap-3 text-[14px]"
                style={{ color: T.ink.base }}
              >
                <span className="truncate">{h.name}</span>
                <span
                  className="shrink-0"
                  style={{ fontFamily: T.font.mono, fontSize: 12.5 }}
                >
                  {h._geo!.lat.toFixed(4)}, {h._geo!.lng.toFixed(4)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </aside>
  )
}
