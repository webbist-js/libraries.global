import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { WidgetTitle } from "@/components/library/LibraryInfoCards"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

// collectionStats is a JSON array of { value: string; label: string; note?: string }
type CollectionStat = {
  value: string
  label: string
  note?: string | null
}

export function LibraryCollectionStats({
  stats,
}: {
  readonly stats: CollectionStat[]
}) {
  if (!stats.length) return null

  return (
    <div className={cn(homepagePanelClassName, "p-5 sm:p-6")}>
      <WidgetTitle>Collection</WidgetTitle>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, 1fr)`,
          gap: "2px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        {stats.map((stat, i) => (
          <div
            key={i}
            style={{
              padding: "20px 16px",
              background: "rgba(255,255,255,.015)",
              borderRight:
                i < stats.length - 1 ? `1px solid ${T.border.line}` : "none",
            }}
          >
            <div
              style={{
                fontFamily: T.font.serif,
                fontWeight: 400,
                fontSize: "28px",
                lineHeight: 1,
                color: T.ink.base,
                marginBottom: "6px",
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: T.ink.low,
              }}
            >
              {stat.label}
            </div>
            {stat.note ? (
              <div
                style={{
                  fontSize: "11px",
                  color: T.ink.faint,
                  marginTop: "4px",
                }}
              >
                {stat.note}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

LibraryCollectionStats.displayName = "LibraryCollectionStats"

export default LibraryCollectionStats
