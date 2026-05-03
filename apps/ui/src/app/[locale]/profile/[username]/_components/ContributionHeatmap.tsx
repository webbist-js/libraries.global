"use client"

import { useMemo } from "react"

import type { PublicSubmission } from "@/app/api/profile/[username]/contributions/route"
import { T } from "@/lib/design-tokens"

// ── Helpers ───────────────────────────────────────────────────────────────────

function heatColor(count: number, isFuture: boolean): string {
  if (isFuture || count === 0) return "rgba(255,255,255,0.04)"
  if (count <= 2) return "rgba(127,223,255,0.18)"
  if (count <= 5) return "rgba(127,223,255,0.40)"
  if (count <= 10) return "rgba(127,223,255,0.64)"

  return "rgba(127,223,255,0.90)"
}

function buildGrid(
  dateCountMap: Map<string, number>,
  now: Date
): { date: Date; count: number; isFuture: boolean }[][] {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todayDow = (today.getDay() + 6) % 7 // 0=Mon … 6=Sun
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - todayDow)
  const startMonday = new Date(thisMonday)
  startMonday.setDate(thisMonday.getDate() - 25 * 7)

  // grid[col=week][row=day]: col 0 = 25 weeks ago, col 25 = current week
  return Array.from({ length: 26 }, (_, col) =>
    Array.from({ length: 7 }, (_, row) => {
      const d = new Date(startMonday)
      d.setDate(startMonday.getDate() + col * 7 + row)

      return {
        date: d,
        count: dateCountMap.get(d.toISOString().slice(0, 10)) ?? 0,
        isFuture: d > today,
      }
    })
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

const LEGEND_CELL = 11

export function ContributionHeatmap({
  submissions,
  now,
}: {
  submissions: PublicSubmission[]
  now: number
}) {
  const dateCountMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of submissions) {
      const key = s.createdAt.slice(0, 10)
      m.set(key, (m.get(key) ?? 0) + 1)
    }

    return m
  }, [submissions])

  const grid = useMemo(
    () => buildGrid(dateCountMap, new Date(now)),
    [dateCountMap, now]
  )

  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "14px",
        padding: "20px 24px",
        background: T.bg.surface,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "10px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.serif,
            fontSize: "18px",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: T.ink.base,
          }}
        >
          Activity
        </span>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          § Last 26 weeks
        </span>
      </div>
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: T.ink.faint,
          margin: "0 0 14px",
        }}
      >
        Daily contribution graph
      </p>

      {/* Grid: columns = weeks, rows = Mon→Sun — fills full container width */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(26, 1fr)",
          gap: "3px",
        }}
      >
        {grid.flatMap((week, col) =>
          week.map((cell, row) => (
            <div
              key={`${col}-${row}`}
              title={
                !cell.isFuture
                  ? `${cell.date.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}: ${cell.count} contribution${cell.count !== 1 ? "s" : ""}`
                  : undefined
              }
              style={{
                gridColumn: col + 1,
                gridRow: row + 1,
                aspectRatio: "1",
                borderRadius: "2px",
                background: heatColor(cell.count, cell.isFuture),
              }}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "10px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            color: T.ink.faint,
            letterSpacing: ".06em",
          }}
        >
          Mon – Sun, last 182 days
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              color: T.ink.faint,
              letterSpacing: ".06em",
              marginRight: "2px",
            }}
          >
            Less
          </span>
          {[0, 2, 5, 10, 15].map((v) => (
            <div
              key={v}
              style={{
                width: `${LEGEND_CELL}px`,
                height: `${LEGEND_CELL}px`,
                borderRadius: "2px",
                background: heatColor(v, false),
              }}
            />
          ))}
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              color: T.ink.faint,
              letterSpacing: ".06em",
              marginLeft: "2px",
            }}
          >
            More
          </span>
        </div>
      </div>
    </div>
  )
}
