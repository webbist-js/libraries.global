import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"
import type { FollowedLibrary } from "@/lib/types/profile"

const LIBRARY_TYPE_GRADIENT: Record<string, string> = {
  National: "linear-gradient(135deg, #0a1a2d 0%, #0d0d2e 100%)",
  Public: "linear-gradient(135deg, #0a1f1a 0%, #071428 100%)",
  Academic: "linear-gradient(135deg, #1a1a0d 0%, #0d1a2e 100%)",
  University: "linear-gradient(135deg, #1a1a0d 0%, #0d1a2e 100%)",
  Parliamentary: "linear-gradient(135deg, #1a0a0d 0%, #0d0a1a 100%)",
  Monastic: "linear-gradient(135deg, #1a0a2d 0%, #2d1a0a 100%)",
  Archive: "linear-gradient(135deg, #1a100a 0%, #0d1a1a 100%)",
}

function libraryGradient(type?: string | null): string {
  return (
    LIBRARY_TYPE_GRADIENT[type ?? ""] ??
    "linear-gradient(135deg, #0a0d1a 0%, #0d0a2e 100%)"
  )
}

export function FollowingTab({
  followedLibraries,
}: {
  followedLibraries: FollowedLibrary[]
}) {
  if (followedLibraries.length === 0) {
    return (
      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          padding: "48px",
          textAlign: "center",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.faint,
            margin: "0 0 8px",
          }}
        >
          Following · Libraries
        </p>
        <p style={{ fontSize: "14px", color: T.ink.faint, margin: 0 }}>
          Libraries you follow will appear here.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p
          style={{
            fontFamily: T.font.serif,
            fontSize: "18px",
            fontWeight: 600,
            color: T.ink.base,
            margin: 0,
          }}
        >
          Following
        </p>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          {followedLibraries.length}{" "}
          {followedLibraries.length === 1 ? "library" : "libraries"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        {followedLibraries.map((lib) => (
          <div
            key={lib.documentId}
            style={{
              borderRadius: "10px",
              border: `1px solid ${T.border.line}`,
              overflow: "hidden",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{
                height: "90px",
                background: libraryGradient(lib.libraryType),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {lib.libraryType && (
                <div
                  style={{
                    position: "absolute",
                    top: "8px",
                    left: "8px",
                    fontFamily: T.font.mono,
                    fontSize: "7px",
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: T.ink.dim,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(0,0,0,0.4)",
                  }}
                >
                  {lib.libraryType}
                </div>
              )}
              <Icon
                icon="mdi:domain"
                width={30}
                height={30}
                style={{ color: "rgba(255,255,255,0.1)" }}
              />
            </div>
            <div style={{ padding: "12px 14px" }}>
              <p
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "12px",
                  fontWeight: 500,
                  color: T.ink.base,
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {lib.name}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
