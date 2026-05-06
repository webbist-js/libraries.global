// apps/ui/src/components/library-index/LibraryIndexCard.tsx
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  buildLibraryPath,
  libraryHeroUrl,
  type LibrarySearchHit,
} from "@/lib/meilisearch"
import { auroraCtaSm } from "@/lib/styles"

// ── Type colour map ────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  National: "#e8c98a",
  Public: "#7fdfff",
  Academic: "#a390ff",
  University: "#a390ff",
  Parliamentary: "#e8c98a",
  Special: "#ffb88a",
  Archive: "#ffb88a",
  Municipal: "#7fdfff",
  Monastic: "#8ef0b3",
  Cultural: "#ffb88a",
  Digital: "#7fdfff",
  Mobile: "#8ef0b3",
  Private: "#a390ff",
  State: "#7fdfff",
  Other: T.ink.faint,
}

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  temporarily_closed: "Temp. Closed",
  permanently_closed: "Permanently Closed",
  seasonal: "Seasonal",
  appointment_only: "By Appt.",
  planned: "Planned",
  unknown: "Unknown",
}

const STATUS_COLORS: Record<string, string> = {
  open: T.accent.ok,
  temporarily_closed: T.accent.warn,
  permanently_closed: T.accent.danger,
  seasonal: T.accent.ember,
  appointment_only: T.accent.aurora,
  planned: T.accent.violet,
  unknown: T.ink.faint,
}

// ── Component ──────────────────────────────────────────────────────────────────
interface LibraryIndexCardProps {
  readonly hit: LibrarySearchHit
}

export function LibraryIndexCard({ hit }: LibraryIndexCardProps) {
  const imageUrl = libraryHeroUrl(hit)
  const libraryPath = buildLibraryPath(hit)
  const typeColor = TYPE_COLORS[hit.libraryType ?? ""] ?? T.ink.faint
  const statusLabel = STATUS_LABELS[hit.operationalStatus ?? ""] ?? ""
  const statusColor = STATUS_COLORS[hit.operationalStatus ?? ""] ?? T.ink.faint

  // Breadcrumb: EUROPE · UK · GREATER LONDON (use available names)
  const breadcrumbParts = [
    hit.continent_name,
    hit.country_name,
    hit.region_name,
  ].filter(Boolean)

  return (
    <div
      className="lib-card"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 200ms ease",
      }}
    >
      {/* Image area */}
      <div
        className="lib-card-img"
        style={{ position: "relative", height: "160px", flexShrink: 0 }}
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={hit.name}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "saturate(0.75) brightness(0.85)" }}
              loading="lazy"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(5,8,22,0.65) 0%, rgba(5,8,22,0) 40%, rgba(5,8,22,0.7) 100%)",
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 90% 70% at 20% 30%, rgba(127,223,255,0.10), transparent 60%),
                radial-gradient(ellipse 70% 90% at 75% 75%, rgba(163,144,255,0.08), transparent 55%),
                radial-gradient(ellipse 50% 50% at 55% 20%, rgba(232,201,138,0.05), transparent 50%),
                linear-gradient(160deg, #08101f 0%, #060c1a 60%, #070b1e 100%)
              `,
            }}
          />
        )}

        {/* Top-left: featured badge OR entity-ref + type */}
        <div className="absolute top-0 left-0 flex items-center gap-2 p-3">
          {hit.featured ? (
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".22em",
                textTransform: "uppercase",
                color: T.accent.gold,
                borderColor: "rgba(232,201,138,0.3)",
                background: "rgba(232,201,138,0.12)",
                border: "1px solid",
                borderRadius: "999px",
                padding: "2px 8px",
              }}
            >
              ✦ Featured
            </span>
          ) : (
            <>
              {hit.entityRef && (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                    background: "rgba(0,0,0,0.45)",
                    border: `1px solid ${T.border.line}`,
                    borderRadius: "6px",
                    padding: "2px 6px",
                  }}
                >
                  {hit.entityRef}
                </span>
              )}
              {hit.libraryType && (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".18em",
                    textTransform: "uppercase",
                    color: typeColor,
                    background: `${typeColor}18`,
                    border: `1px solid ${typeColor}28`,
                    borderRadius: "999px",
                    padding: "2px 7px",
                  }}
                >
                  {hit.libraryType}
                </span>
              )}
            </>
          )}
        </div>

        {/* Top-right: operational status */}
        {hit.operationalStatus && (
          <div className="absolute top-0 right-0 p-3">
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: statusColor,
                background: `${statusColor}18`,
                border: `1px solid ${statusColor}28`,
                borderRadius: "999px",
                padding: "2px 7px",
              }}
            >
              {statusLabel}
            </span>
          </div>
        )}
      </div>

      {/* Content area */}
      <div
        style={{
          padding: "14px 18px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flex: 1,
        }}
      >
        {/* Breadcrumb */}
        {breadcrumbParts.length > 0 && (
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: T.ink.faint,
              margin: 0,
            }}
          >
            {breadcrumbParts.join(" · ")}
          </p>
        )}

        {/* Name */}
        <h3
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(1.1rem, 1.4vw, 1.35rem)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: T.ink.base,
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {hit.name}
        </h3>

        {/* Summary */}
        {hit.summary && (
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.55,
              color: T.ink.low,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {hit.summary}
          </p>
        )}

        {/* Spacer + bottom row */}
        <div style={{ marginTop: "auto", paddingTop: "8px" }}>
          {libraryPath ? (
            <GlobalLink href={libraryPath} className={auroraCtaSm}>
              Explore →
            </GlobalLink>
          ) : null}
        </div>
      </div>

      <style>{`
        .lib-card:hover {
          border-color: rgba(127,223,255,0.18) !important;
        }
      `}</style>
    </div>
  )
}
