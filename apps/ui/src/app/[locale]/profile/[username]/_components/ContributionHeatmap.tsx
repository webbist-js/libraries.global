"use client"

import { useMemo } from "react"

import type { PublicSubmission } from "@/app/api/profile/[username]/contributions/route"
import { T } from "@/lib/design-tokens"

// ── Helpers ───────────────────────────────────────────────────────────────────

function heatColor(count: number, isFuture: boolean): string {
  if (isFuture) return "transparent"
  if (count === 0) return "#F0ECE5"
  if (count <= 2) return "#D6D2F6"
  if (count <= 5) return "#A59DEB"

  return "#4338CA"
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
        borderRadius: "20px",
        padding: "20px 24px",
        background: T.bg.deep,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "14px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.serif,
            fontSize: "24px",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: T.ink.base,
          }}
        >
          Activity
        </span>
        <span style={{ fontSize: "14px", color: T.ink.dim }}>
          Last 26 weeks
        </span>
      </div>

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
                borderRadius: "4px",
                background: heatColor(cell.count, cell.isFuture),
              }}
            />
          ))
        )}
      </div>

      {/* Text alternative */}
      <details style={{ marginTop: "12px" }}>
        <summary
          style={{ fontSize: "14px", color: T.ink.dim, cursor: "pointer" }}
        >
          Activity as text
        </summary>
        <p style={{ fontSize: "14px", color: T.ink.dim, margin: "8px 0 0" }}>
          {submissions.length} contribution
          {submissions.length === 1 ? "" : "s"} recorded in the last 26 weeks
          across {dateCountMap.size} active day
          {dateCountMap.size === 1 ? "" : "s"}.
        </p>
      </details>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "10px",
        }}
      >
        <span style={{ fontSize: "13px", color: T.ink.low }}>
          Mon – Sun, last 182 days
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            style={{
              fontSize: "13px",
              color: T.ink.low,
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
                borderRadius: "4px",
                background: heatColor(v, false),
              }}
            />
          ))}
          <span
            style={{
              fontSize: "13px",
              color: T.ink.low,
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
