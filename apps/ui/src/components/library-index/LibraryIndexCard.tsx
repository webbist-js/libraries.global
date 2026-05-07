// apps/ui/src/components/library-index/LibraryIndexCard.tsx
import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  buildLibraryPath,
  libraryHeroUrl,
  type LibrarySearchHit,
} from "@/lib/meilisearch"

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
  readonly view?: "grid" | "list"
}

export function LibraryIndexCard({
  hit,
  view = "grid",
}: LibraryIndexCardProps) {
  const imageUrl = libraryHeroUrl(hit)
  const libraryPath = buildLibraryPath(hit)
  const typeColor = TYPE_COLORS[hit.libraryType ?? ""] ?? T.ink.faint
  const statusColor = STATUS_COLORS[hit.operationalStatus ?? ""] ?? T.ink.faint
  const statusLabel = STATUS_LABELS[hit.operationalStatus ?? ""] ?? ""
  const isOpen = hit.operationalStatus === "open"

  // Build geo breadcrumb paths
  const continentPath = hit.continent_slug ? `/${hit.continent_slug}` : null
  const countryPath =
    hit.continent_slug && hit.country_slug
      ? `/${hit.continent_slug}/${hit.country_slug}`
      : null
  const regionPath =
    hit.continent_slug && hit.country_slug && hit.region_slug
      ? `/${hit.continent_slug}/${hit.country_slug}/${hit.region_slug}`
      : null

  // ── List view ──────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div
        className="lib-card lib-list-row"
        style={{
          background: "rgba(255,255,255,.025)",
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          transition:
            "border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease",
        }}
      >
        {/* Thumbnail */}
        <div style={{ position: "relative", width: "96px", flexShrink: 0 }}>
          {imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt={hit.name}
                fill
                className="object-cover"
                style={{ filter: "saturate(0.7) brightness(0.8)" }}
                sizes="96px"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to right, rgba(5,8,22,0) 60%, rgba(5,8,22,0.6) 100%)",
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse 120% 100% at 20% 50%, rgba(127,223,255,0.08), transparent 70%),
                  linear-gradient(135deg, #08101f 0%, #070b1e 100%)`,
              }}
            />
          )}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            justifyContent: "center",
            minWidth: 0,
          }}
        >
          {/* Breadcrumb */}
          <p
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "4px",
              flexWrap: "wrap",
            }}
          >
            {continentPath && hit.continent_name && (
              <GlobalLink
                href={continentPath}
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: T.accent.aurora,
                  opacity: 0.7,
                  textDecoration: "none",
                }}
              >
                {hit.continent_name}
              </GlobalLink>
            )}
            {hit.country_name && (
              <>
                <span style={{ color: T.ink.ghost, fontSize: "9px" }}>·</span>
                {countryPath ? (
                  <GlobalLink
                    href={countryPath}
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      letterSpacing: ".18em",
                      textTransform: "uppercase",
                      color: T.accent.aurora,
                      opacity: 0.7,
                      textDecoration: "none",
                    }}
                  >
                    {hit.country_name}
                  </GlobalLink>
                ) : (
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      letterSpacing: ".18em",
                      textTransform: "uppercase",
                      color: T.ink.faint,
                    }}
                  >
                    {hit.country_name}
                  </span>
                )}
              </>
            )}
          </p>

          {/* Name */}
          <h3
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.1rem",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: T.ink.base,
              margin: 0,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {hit.name}
          </h3>

          {/* Meta row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "2px",
            }}
          >
            {hit.libraryType && (
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                  color: typeColor,
                  background: `${typeColor}15`,
                  border: `1px solid ${typeColor}25`,
                  borderRadius: "4px",
                  padding: "1px 5px",
                }}
              >
                {hit.libraryType}
              </span>
            )}
            {hit.city && (
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                }}
              >
                {hit.city}
              </span>
            )}
            {hit.foundedYear && (
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".12em",
                  color: T.ink.ghost,
                }}
              >
                Est. {hit.foundedYear}
              </span>
            )}
          </div>
        </div>

        {/* Right: status pip + arrow */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "12px 16px",
          }}
        >
          {hit.operationalStatus && (
            <span
              title={statusLabel}
              style={{
                display: "block",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: statusColor,
                flexShrink: 0,
              }}
              className={isOpen ? "pip-open" : undefined}
            />
          )}
          {libraryPath && (
            <GlobalLink
              href={libraryPath}
              style={{
                fontFamily: T.font.mono,
                fontSize: "13px",
                color: T.ink.faint,
                textDecoration: "none",
                lineHeight: 1,
              }}
            >
              →
            </GlobalLink>
          )}
        </div>

        <style>{`
          .lib-list-row:hover {
            border-color: rgba(127,223,255,0.2) !important;
            transform: translateX(2px);
          }
          @keyframes pip-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(142,240,179,0.5); }
            50% { box-shadow: 0 0 0 5px rgba(142,240,179,0); }
          }
          .pip-open { animation: pip-pulse 2.4s ease-in-out infinite; }
        `}</style>
      </div>
    )
  }

  // ── Grid view (default) ────────────────────────────────────────────────────
  return (
    <div
      className="lib-card"
      style={{
        background: "rgba(255,255,255,.025)",
        border: `1px solid ${T.border.line}`,
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition:
          "border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease",
      }}
    >
      {/* Image area */}
      <div
        className="lib-card-img"
        style={{ position: "relative", height: "180px", flexShrink: 0 }}
      >
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt={hit.name}
              fill
              className="object-cover"
              style={{ filter: "saturate(0.75) brightness(0.85)" }}
              sizes="(max-width: 640px) 100vw, 50vw"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(5,8,22,0.6) 0%, rgba(5,8,22,0) 40%, rgba(5,8,22,0.75) 100%)",
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

        {/* Top-left: featured badge OR type chip */}
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
                borderRadius: "4px",
                padding: "2px 7px",
              }}
            >
              ✦ Pillar
            </span>
          ) : (
            hit.libraryType && (
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: typeColor,
                  background: `${typeColor}18`,
                  border: `1px solid ${typeColor}28`,
                  borderRadius: "4px",
                  padding: "2px 7px",
                }}
              >
                {hit.libraryType}
              </span>
            )
          )}
        </div>

        {/* Top-right: status pip */}
        {hit.operationalStatus && (
          <div className="absolute top-0 right-0 flex items-center gap-1.5 p-3">
            <span
              className={isOpen ? "pip-open" : undefined}
              title={statusLabel}
              style={{
                display: "block",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: statusColor,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: statusColor,
                background: "rgba(0,0,0,0.45)",
                padding: "2px 6px",
                borderRadius: "4px",
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
          padding: "14px 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          flex: 1,
        }}
      >
        {/* Geo breadcrumb with aurora links */}
        <p
          style={{
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexWrap: "wrap",
          }}
        >
          {continentPath && hit.continent_name && (
            <GlobalLink
              href={continentPath}
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: T.accent.aurora,
                opacity: 0.65,
                textDecoration: "none",
              }}
            >
              {hit.continent_name}
            </GlobalLink>
          )}
          {hit.country_name && (
            <>
              <span style={{ color: T.ink.ghost, fontSize: "9px" }}>·</span>
              {countryPath ? (
                <GlobalLink
                  href={countryPath}
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".18em",
                    textTransform: "uppercase",
                    color: T.accent.aurora,
                    opacity: 0.65,
                    textDecoration: "none",
                  }}
                >
                  {hit.country_name}
                </GlobalLink>
              ) : (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".18em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                  }}
                >
                  {hit.country_name}
                </span>
              )}
            </>
          )}
          {hit.region_name && (
            <>
              <span style={{ color: T.ink.ghost, fontSize: "9px" }}>·</span>
              {regionPath ? (
                <GlobalLink
                  href={regionPath}
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".18em",
                    textTransform: "uppercase",
                    color: T.accent.aurora,
                    opacity: 0.65,
                    textDecoration: "none",
                  }}
                >
                  {hit.region_name}
                </GlobalLink>
              ) : (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".18em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                  }}
                >
                  {hit.region_name}
                </span>
              )}
            </>
          )}
        </p>

        {/* Entity ref + Name */}
        <div>
          {hit.entityRef && (
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: T.ink.ghost,
                margin: "0 0 3px",
              }}
            >
              № {hit.entityRef}
            </p>
          )}
          <h3
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(1.1rem, 1.4vw, 1.3rem)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: T.ink.base,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {hit.name}
          </h3>
        </div>

        {/* Mini-stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0",
            borderTop: `1px solid ${T.border.line}`,
            borderBottom: `1px solid ${T.border.line}`,
            marginTop: "4px",
          }}
        >
          {/* Collection items — TODO: not yet in MeiliSearch index */}
          <div
            style={{
              padding: "7px 0",
              borderRight: `1px solid ${T.border.line}`,
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <span
              style={{
                fontFamily: T.font.serif,
                fontSize: "14px",
                color: T.ink.faint,
                lineHeight: 1,
                letterSpacing: "-.01em",
              }}
            >
              {/* TODO: collectionStats not yet indexed in MeiliSearch */}—
            </span>
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "8px",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: T.ink.ghost,
              }}
            >
              Items
            </span>
          </div>

          {/* Founded year */}
          <div
            style={{
              padding: "7px 8px",
              borderRight: `1px solid ${T.border.line}`,
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <span
              style={{
                fontFamily: T.font.serif,
                fontSize: "14px",
                color: hit.foundedYear ? T.ink.dim : T.ink.faint,
                lineHeight: 1,
                letterSpacing: "-.01em",
              }}
            >
              {hit.foundedYear ?? "—"}
            </span>
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "8px",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: T.ink.ghost,
              }}
            >
              Founded
            </span>
          </div>

          {/* City */}
          <div
            style={{
              padding: "7px 8px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <span
              style={{
                fontFamily: T.font.serif,
                fontSize: "14px",
                color: hit.city ? T.ink.dim : T.ink.faint,
                lineHeight: 1,
                letterSpacing: "-.01em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {hit.city ?? "—"}
            </span>
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "8px",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: T.ink.ghost,
              }}
            >
              City
            </span>
          </div>
        </div>

        {/* Footer row: chips + explore arrow */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          {/* Feature chips — TODO: services/amenities not yet indexed */}
          <div
            style={{ display: "flex", gap: "4px", flexWrap: "wrap", flex: 1 }}
          >
            {hit.featured && (
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "8px",
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: T.accent.gold,
                  background: "rgba(232,201,138,0.1)",
                  border: "1px solid rgba(232,201,138,0.25)",
                  borderRadius: "3px",
                  padding: "2px 5px",
                }}
              >
                ✦ Pillar
              </span>
            )}
            {/* TODO: add service/amenity chips once indexed in MeiliSearch */}
          </div>

          {libraryPath ? (
            <GlobalLink
              href={libraryPath}
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: T.accent.aurora,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                flexShrink: 0,
                opacity: 0.8,
                transition: "opacity 150ms",
              }}
            >
              Explore →
            </GlobalLink>
          ) : null}
        </div>
      </div>

      <style>{`
        .lib-card:hover {
          border-color: rgba(127,223,255,0.22) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(127,223,255,0.07);
        }
        @keyframes pip-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(142,240,179,0.5); }
          50% { box-shadow: 0 0 0 5px rgba(142,240,179,0); }
        }
        .pip-open { animation: pip-pulse 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
