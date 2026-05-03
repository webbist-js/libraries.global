"use client"

import { Icon } from "@iconify/react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

// ── Helpers ───────────────────────────────────────────────────────────────────

async function saveThemeToProfile(theme: "dark" | "light"): Promise<boolean> {
  try {
    const res = await fetch("/api/profile/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    })

    return res.ok
  } catch {
    return false
  }
}

// ── Theme option card ─────────────────────────────────────────────────────────

function ThemeCard({
  value,
  currentTheme,
  onSelect,
}: {
  value: "dark" | "light"
  currentTheme: string | undefined
  onSelect: (v: "dark" | "light") => void
}) {
  const active = currentTheme === value
  const isDark = value === "dark"

  return (
    <button
      onClick={() => onSelect(value)}
      style={{
        flex: "1 1 160px",
        borderRadius: "12px",
        border: `1px solid ${active ? "var(--t-aurora-edge)" : "var(--t-border-line)"}`,
        background: active ? "var(--t-aurora-soft)" : "var(--t-bg-deep)",
        padding: "0",
        cursor: "pointer",
        overflow: "hidden",
        transition: "border-color 150ms, background 150ms",
        textAlign: "left",
      }}
    >
      {/* Preview area */}
      <div
        style={{
          height: "80px",
          background: isDark
            ? "linear-gradient(135deg, #030511 0%, #050816 50%, #070b1e 100%)"
            : "linear-gradient(135deg, #fbf8f1 0%, #f5f0e3 50%, #fcfaf4 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "12px",
          position: "relative",
        }}
      >
        {/* Mini UI chrome */}
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "8px",
          }}
        >
          {/* Fake header bar */}
          <div
            style={{
              height: "8px",
              borderRadius: "2px",
              background: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.08)",
              width: "60%",
            }}
          />
          {/* Fake content lines */}
          {[70, 50, 80].map((w, i) => (
            <div
              key={i}
              style={{
                height: "5px",
                borderRadius: "2px",
                background: isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.05)",
                width: `${w}%`,
                marginTop: i === 0 ? "4px" : 0,
              }}
            />
          ))}
        </div>
        <Icon
          icon={isDark ? "mdi:weather-night" : "mdi:weather-sunny"}
          width={22}
          style={{
            color: isDark ? "#7fdfff" : "#b89030",
            position: "relative",
            zIndex: 1,
          }}
        />
      </div>

      {/* Label */}
      <div style={{ padding: "10px 14px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {active && (
            <Icon
              icon="mdi:check-circle"
              width={13}
              style={{ color: "var(--t-accent-aurora)", flexShrink: 0 }}
            />
          )}
          <span
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              fontWeight: 500,
              color: active ? "var(--t-ink-base)" : "var(--t-ink-dim)",
              textTransform: "capitalize",
            }}
          >
            {value} theme
          </span>
        </div>
      </div>
    </button>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function AppearanceSection({
  profile,
}: {
  profile: UserProfile | null
}) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Apply saved profile theme on mount
    if (profile?.theme && profile.theme !== theme) {
      setTheme(profile.theme)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSelect(value: "dark" | "light") {
    setTheme(value)
    if (!profile) return

    setSaving(true)
    setSaved(false)
    const ok = await saveThemeToProfile(value)
    setSaving(false)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Section heading */}
      <div>
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".20em",
            textTransform: "uppercase",
            color: "var(--t-ink-faint)",
            margin: "0 0 6px",
          }}
        >
          Appearance
        </p>
        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--t-ink-base)",
            margin: "0 0 4px",
          }}
        >
          Theme
        </h2>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: "var(--t-ink-faint)",
            margin: 0,
          }}
        >
          Choose how libraries.global looks to you.
          {profile
            ? " Your preference is saved to your profile."
            : " Sign in to save across devices."}
        </p>
      </div>

      {/* Theme cards */}
      {mounted ? (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <ThemeCard
            value="dark"
            currentTheme={theme}
            onSelect={handleSelect}
          />
          <ThemeCard
            value="light"
            currentTheme={theme}
            onSelect={handleSelect}
          />
        </div>
      ) : (
        <div
          style={{
            height: "140px",
            borderRadius: "12px",
            background: "var(--t-bg-deep)",
            border: `1px solid var(--t-border-line)`,
          }}
        />
      )}

      {/* Saving indicator */}
      {(saving || saved) && profile && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            fontFamily: T.font.mono,
            letterSpacing: ".08em",
            color: saved ? "var(--t-accent-ok)" : "var(--t-ink-faint)",
          }}
        >
          <Icon
            icon={saved ? "mdi:check-circle-outline" : "mdi:loading"}
            width={13}
            className={saving ? "animate-spin" : ""}
          />
          {saved ? "Saved to profile" : "Saving…"}
        </div>
      )}
    </div>
  )
}
