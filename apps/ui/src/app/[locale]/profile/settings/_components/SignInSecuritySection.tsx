"use client"

import { Icon } from "@iconify/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

type SessionEntry = {
  id: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: string
  current?: boolean
}

type Account = {
  id: string
  accountId: string
  providerId: string
  createdAt: string
}

const PROVIDER_META: Record<string, { label: string; icon: string }> = {
  credential: { label: "Email & password", icon: "mdi:email-lock-outline" },
  "magic-link": { label: "Magic link", icon: "mdi:email-fast-outline" },
  google: { label: "Google", icon: "mdi:google" },
  github: { label: "GitHub", icon: "mdi:github" },
}

function providerMeta(providerId: string) {
  return (
    PROVIDER_META[providerId] ?? { label: providerId, icon: "mdi:link-variant" }
  )
}

/** "Chrome on macOS" from a user-agent string — best-effort, honest fallback. */
function describeDevice(userAgent?: string | null): string {
  if (!userAgent) return "Unknown device"
  const browser = userAgent.includes("Firefox/")
    ? "Firefox"
    : userAgent.includes("Edg/")
      ? "Edge"
      : userAgent.includes("Chrome/")
        ? "Chrome"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Browser"
  const os = userAgent.includes("Mac OS X")
    ? "macOS"
    : userAgent.includes("Windows")
      ? "Windows"
      : userAgent.includes("Android")
        ? "Android"
        : userAgent.includes("iPhone") || userAgent.includes("iPad")
          ? "iOS"
          : userAgent.includes("Linux")
            ? "Linux"
            : "unknown OS"

  return `${browser} on ${os}`
}

const pillButton = {
  padding: "8px 16px",
  borderRadius: "999px",
  border: `1px solid ${T.border.hi}`,
  background: T.bg.deep,
  color: T.ink.base,
  fontSize: "14px",
  fontFamily: T.font.sans,
  fontWeight: 600,
  cursor: "pointer" as const,
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
}

export function SignInSecuritySection() {
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/profile/me/sessions")
        .then((r) => r.json())
        .then((json: { data?: SessionEntry[] }) => json.data ?? [])
        .catch(() => []),
      fetch("/api/profile/me/connections")
        .then((r) => r.json())
        .then((json: { data?: Account[] }) => json.data ?? [])
        .catch(() => []),
    ])
      .then(([s, a]) => {
        setSessions(s)
        setAccounts(a)
      })
      .finally(() => setLoading(false))
  }, [])

  const revokeSession = async (id: string) => {
    setRevoking(id)
    const res = await fetch("/api/profile/me/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setSessions((s) => s.filter((x) => x.id !== id))
      toast.success("Session signed out")
    } else {
      toast.error("Failed to sign out session")
    }
    setRevoking(null)
  }

  const revokeAll = async () => {
    const res = await fetch("/api/profile/me/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      setSessions((s) => s.filter((x) => x.current))
      toast.success("Signed out everywhere else")
    } else {
      toast.error("Failed to sign out sessions")
    }
  }

  const disconnect = async (providerId: string) => {
    const res = await fetch("/api/profile/me/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId }),
    })
    if (res.ok) {
      setAccounts((prev) => prev.filter((a) => a.providerId !== providerId))
      toast.success(`${providerMeta(providerId).label} disconnected`)
    } else {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      toast.error(json.error ?? "Failed to disconnect")
    }
  }

  const rowStyle = {
    borderBottom: `1px solid ${T.border.divider}`,
  }

  return (
    <div>
      <h2
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontSize: "24px",
          fontWeight: 500,
          color: T.ink.base,
        }}
      >
        Sign-in &amp; security
      </h2>
      <p className="mt-1 mb-5 text-[15px]" style={{ color: T.ink.dim }}>
        How you sign in, and where you&rsquo;re signed in right now.
      </p>

      {/* Two-step verification */}
      <div
        className="flex items-center justify-between gap-4 py-3.5"
        style={rowStyle}
      >
        <div>
          <p
            className="m-0 text-[15px] font-medium"
            style={{ color: T.ink.base }}
          >
            Two-step verification
          </p>
          <p className="m-0 mt-0.5 text-[14px]" style={{ color: T.ink.dim }}>
            Ask for a code from an authenticator app when you sign in.
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold"
          style={{
            background: "var(--tint-special-bg)",
            color: "var(--tint-special-fg)",
          }}
        >
          Coming soon
        </span>
      </div>

      {/* Connected sign-in methods */}
      {loading ? (
        <p className="py-3.5 text-[14px]" style={{ color: T.ink.low }}>
          Loading sign-in methods…
        </p>
      ) : (
        accounts.map((acct) => {
          const meta = providerMeta(acct.providerId)
          const others = accounts.filter(
            (a) => a.providerId !== acct.providerId
          )
          const isOnly = others.length === 0

          return (
            <div
              key={acct.id}
              className="flex items-center justify-between gap-4 py-3.5"
              style={rowStyle}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Icon
                  icon={meta.icon}
                  width={20}
                  height={20}
                  aria-hidden="true"
                  style={{ color: T.ink.dim, flexShrink: 0 }}
                />
                <div className="min-w-0">
                  <p
                    className="m-0 text-[15px] font-medium"
                    style={{ color: T.ink.base }}
                  >
                    {meta.label}
                  </p>
                  <p
                    className="m-0 mt-0.5 truncate text-[14px]"
                    style={{ color: T.ink.dim }}
                  >
                    {isOnly
                      ? "Your only sign-in method. Add another before you can disconnect it."
                      : acct.accountId.includes("@")
                        ? acct.accountId
                        : "Connected"}
                  </p>
                </div>
              </div>
              {isOnly ? (
                <GlobalLink
                  href="/auth/change-password"
                  style={{ ...pillButton, textDecoration: "none" }}
                >
                  Add a sign-in method
                </GlobalLink>
              ) : (
                <button
                  type="button"
                  onClick={() => void disconnect(acct.providerId)}
                  style={pillButton}
                >
                  Disconnect
                </button>
              )}
            </div>
          )
        })
      )}

      {/* Sessions */}
      <p
        className="m-0 mt-6 mb-1 text-[15px] font-semibold"
        style={{ color: T.ink.base }}
      >
        Where you&rsquo;re signed in
      </p>
      {loading ? (
        <p className="py-3 text-[14px]" style={{ color: T.ink.low }}>
          Loading sessions…
        </p>
      ) : sessions.length === 0 ? (
        <p className="py-3 text-[14px]" style={{ color: T.ink.dim }}>
          No active sessions found.
        </p>
      ) : (
        sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-4 py-3.5"
            style={rowStyle}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border"
                style={{ borderColor: T.border.line, background: T.bg.surface }}
              >
                <Icon
                  icon={
                    s.userAgent?.includes("Mobile")
                      ? "mdi:cellphone"
                      : "mdi:monitor"
                  }
                  width={18}
                  height={18}
                  style={{ color: T.ink.dim }}
                />
              </span>
              <div className="min-w-0">
                <p
                  className="m-0 text-[15px] font-medium"
                  style={{ color: T.ink.base }}
                >
                  {describeDevice(s.userAgent)}
                </p>
                <p
                  className="m-0 mt-0.5 truncate text-[14px]"
                  style={{ color: T.ink.dim }}
                >
                  Signed in {new Date(s.createdAt).toLocaleDateString("en-GB")}
                  {s.ipAddress ? ` · ${s.ipAddress}` : ""}
                </p>
              </div>
            </div>
            {s.current ? (
              <span
                className="shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold text-white"
                style={{ background: T.ink.base }}
              >
                This device
              </span>
            ) : (
              <button
                type="button"
                disabled={revoking === s.id}
                onClick={() => void revokeSession(s.id)}
                style={{
                  ...pillButton,
                  opacity: revoking === s.id ? 0.5 : 1,
                }}
              >
                Sign out
              </button>
            )}
          </div>
        ))
      )}

      {sessions.some((s) => !s.current) ? (
        <div className="pt-4">
          <button
            type="button"
            onClick={() => void revokeAll()}
            style={pillButton}
          >
            Sign out everywhere else
          </button>
        </div>
      ) : null}
    </div>
  )
}
