import { Icon } from "@iconify/react"

import { Badge, Card } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { QuickWin, QuickWinType } from "@/lib/types/profile"

const ICON_MAP: Record<QuickWinType, { icon: string; color: string }> = {
  add_library: { icon: "mdi:plus-box", color: T.accent.ember },
  add_nearby_library: { icon: "mdi:plus-box", color: T.accent.ember },
  verify_hours: { icon: "mdi:text-box-outline", color: T.accent.aurora },
  add_hero_image: { icon: "mdi:image-outline", color: T.accent.violet },
  translate_wiki: { icon: "mdi:translate", color: T.accent.ok },
}

const CTA_LABEL: Record<QuickWinType, string> = {
  add_library: "BEGIN →",
  add_nearby_library: "BEGIN →",
  verify_hours: "VERIFY →",
  add_hero_image: "ATTACH →",
  translate_wiki: "OPEN →",
}

export function QuickWinCard({ win }: { readonly win: QuickWin }) {
  const { icon, color } = ICON_MAP[win.type]
  const ctaLabel = CTA_LABEL[win.type]

  return (
    <Card
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        height: "100%",
        cursor: "pointer",
      }}
    >
      {/* Top row: icon + meta */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: `${color}14`,
            border: `1px solid ${color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon icon={icon} width={18} style={{ color }} />
        </span>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: T.ink.low,
          }}
        >
          +{win.points} PTS · ~{win.estimatedMinutes} MIN
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontFamily: T.font.serif,
            fontSize: "15px",
            fontWeight: 600,
            color: T.ink.base,
            margin: "0 0 6px",
            lineHeight: 1.3,
          }}
        >
          {win.title}
        </h3>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "12px",
            color: T.ink.dim,
            margin: 0,
            lineHeight: 1.65,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {win.description}
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "12px",
          borderTop: `1px solid ${T.border.line}`,
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            REWARD ·
          </span>
          <Badge label={win.rewardLabel} color="dim" />
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            · {win.points} PTS
          </span>
        </div>
        <Link
          href={win.actionUrl}
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.accent.aurora,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {ctaLabel}
        </Link>
      </div>
    </Card>
  )
}
