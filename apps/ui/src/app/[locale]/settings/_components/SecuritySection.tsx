"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { BetterAuthUser } from "@/lib/auth-server"

type SessionEntry = {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: string
}

export function SecuritySection({ sessionUser }: { sessionUser: BetterAuthUser }) {
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/profile/me/sessions")
      .then((r) => r.json())
      .then((json: { data?: SessionEntry[] }) => setSessions(json.data ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [])

  const revokeSession = async (token: string) => {
    setRevoking(token)
    const res = await fetch("/api/profile/me/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: token }),
    })
    if (res.ok) {
      setSessions((s) => s.filter((x) => x.token !== token))
      toast.success("Session revoked")
    } else {
      toast.error("Failed to revoke session")
    }
    setRevoking(null)
  }

  const revokeAll = async () => {
    const res = await fetch("/api/profile/me/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    if (res.ok) { setSessions([]); toast.success("All other sessions signed out") }
    else toast.error("Failed to sign out sessions")
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: T.ink.base }}>Security</h2>
        <p style={{ margin: 0, fontSize: "13px", color: T.ink.faint }}>
          Protect access to your account and review where you&apos;re currently signed in.
        </p>
      </div>

      {/* 2FA — TODO: requires BA twoFactor plugin */}
      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: "13px", color: T.ink.base }}>Two-factor authentication</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.ink.faint }}>
              {/* TODO: enable when BA twoFactor plugin is installed */}
              Requires a code from your authenticator app on sign in.
            </p>
          </div>
          <span style={{ fontFamily: T.font.mono, fontSize: "9px", letterSpacing: ".14em", color: T.ink.faint, textTransform: "uppercase" }}>
            Coming soon
          </span>
        </div>
      </div>

      {/* Active sessions */}
      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${T.border.line}` }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: T.ink.base }}>Active sessions</h3>
        </div>
        {loading ? (
          <div style={{ padding: "20px", textAlign: "center", color: T.ink.faint, fontSize: "13px" }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: T.ink.faint, fontSize: "13px" }}>No sessions found</div>
        ) : (
          sessions.map((s, i) => (
            <div
              key={s.id}
              style={{
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                borderBottom: i < sessions.length - 1 ? `1px solid ${T.border.line}` : "none",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${T.border.line}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  color: T.ink.faint,
                }}
              >
                {s.userAgent?.includes("Mobile") ? "M" : "D"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "12px", color: T.ink.base, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.userAgent ?? "Unknown device"}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: T.ink.faint, fontFamily: T.font.mono }}>
                  {s.ipAddress ?? "—"} · {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                disabled={revoking === s.token}
                onClick={() => revokeSession(s.token)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${T.border.line}`,
                  background: "transparent",
                  color: T.ink.dim,
                  fontSize: "12px",
                  fontFamily: T.font.sans,
                  cursor: "pointer",
                  flexShrink: 0,
                  opacity: revoking === s.token ? 0.5 : 1,
                }}
              >
                Revoke
              </button>
            </div>
          ))
        )}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border.line}`, display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={revokeAll}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.dim,
              fontSize: "12px",
              fontFamily: T.font.sans,
              cursor: "pointer",
            }}
          >
            Sign out all other sessions
          </button>
          <GlobalLink
            href="/auth/change-password"
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.dim,
              fontSize: "12px",
              fontFamily: T.font.sans,
              textDecoration: "none",
            }}
          >
            Change password
          </GlobalLink>
        </div>
      </div>
    </div>
  )
}
