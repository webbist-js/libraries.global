"use client"

import { Icon } from "@iconify/react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface ThemeToggleProps {
  /** Compact icon-only variant for the header. Full variant shows label. */
  variant?: "icon" | "full"
  className?: string
}

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  // Avoid hydration mismatch by waiting for mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0)

    return () => clearTimeout(id)
  }, [])

  if (!mounted) {
    return (
      <div
        style={{ width: variant === "icon" ? 32 : 80, height: 32 }}
        aria-hidden
      />
    )
  }

  const isDark = theme === "dark"

  if (variant === "icon") {
    return (
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        className={className}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "10px",
          border: "1px solid var(--t-border-line)",
          background: "var(--t-bg-surface)",
          color: "var(--t-ink-faint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "color 150ms, background 150ms",
          flexShrink: 0,
        }}
      >
        <Icon
          icon={isDark ? "mdi:weather-sunny" : "mdi:weather-night"}
          width={16}
        />
      </button>
    )
  }

  // Full variant — two-option pill
  return (
    <div
      style={{
        display: "inline-flex",
        borderRadius: "10px",
        border: "1px solid var(--t-border-line)",
        background: "var(--t-bg-deep)",
        overflow: "hidden",
        gap: 0,
      }}
      className={className}
    >
      {(["dark", "light"] as const).map((t) => {
        const active = theme === t

        return (
          <button
            key={t}
            onClick={() => setTheme(t)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: active ? "rgba(127,223,255,0.10)" : "transparent",
              color: active ? "var(--t-accent-aurora)" : "var(--t-ink-faint)",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: "10px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              transition: "background 150ms, color 150ms",
            }}
          >
            <Icon
              icon={t === "dark" ? "mdi:weather-night" : "mdi:weather-sunny"}
              width={13}
            />
            {t}
          </button>
        )
      })}
    </div>
  )
}
