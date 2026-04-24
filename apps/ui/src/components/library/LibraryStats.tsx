import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { WidgetTitle } from "@/components/library/LibraryInfoCards"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

// Accepts either { value, category, description } (collectionStats component)
// or { value, label, note } (libraryStats component) — unified display
export type LibraryStatItem = {
  value: string
  category?: string | null
  description?: string | null
  // legacy / libraryStats aliases
  label?: string | null
  note?: string | null
}

function StatCard({ stat }: { readonly stat: LibraryStatItem }) {
  const category = stat.category ?? stat.label ?? ""
  const description = stat.description ?? stat.note ?? null

  return (
    <div
      style={{
        border: `1px solid rgba(255,255,255,.09)`,
        borderRadius: "16px",
        background: "rgba(255,255,255,.025)",
        padding: "20px 18px",
      }}
    >
      {/* Value */}
      <div
        style={{
          fontFamily: T.font.serif,
          fontWeight: 400,
          fontSize: "52px",
          lineHeight: 1,
          color: T.ink.base,
          marginBottom: "12px",
          letterSpacing: "-.02em",
        }}
      >
        {stat.value}
      </div>

      {/* Category */}
      {category ? (
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.48)",
            marginBottom: "4px",
          }}
        >
          {category}
        </div>
      ) : null}

      {/* Description */}
      {description ? (
        <div
          style={{
            fontSize: "13px",
            color: "rgba(255,255,255,.34)",
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      ) : null}
    </div>
  )
}

export function LibraryStats({ stats }: { readonly stats: LibraryStatItem[] }) {
  if (!stats.length) return null

  return (
    <div className={cn(homepagePanelClassName, "p-5 sm:p-6")}>
      <WidgetTitle>Collection</WidgetTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: "10px" }}>
        {stats.map((stat, i) => (
          <StatCard key={i} stat={stat} />
        ))}
      </div>
    </div>
  )
}

LibraryStats.displayName = "LibraryStats"

export default LibraryStats
