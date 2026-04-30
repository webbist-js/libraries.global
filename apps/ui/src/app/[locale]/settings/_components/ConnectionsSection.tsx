"use client"

import { Icon } from "@iconify/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { T } from "@/lib/design-tokens"

type Account = {
  id: string
  accountId: string // provider's external user ID (often an email for Google/credential)
  providerId: string // "credential" | "google" | "github" | "magic-link" | etc.
  createdAt: string
  scopes?: string[]
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

function formatAccountId(accountId: string): string {
  if (accountId.includes("@")) return accountId
  if (accountId.length > 20)
    return `${accountId.slice(0, 8)}…${accountId.slice(-4)}`

  return accountId
}

export function ConnectionsSection() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch("/api/profile/me/connections")
      .then((r) => r.json())
      .then((json: { data?: Account[] }) => setAccounts(json.data ?? []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  // OAuth accounts that could theoretically be disconnected
  const oauthAccounts = accounts.filter((a) => a.providerId !== "credential")
  const hasCredential = accounts.some((a) => a.providerId === "credential")

  const disconnect = async (providerId: string) => {
    // Must retain at least one sign-in method after removing
    const remainingAfter = accounts.filter((a) => a.providerId !== providerId)
    if (remainingAfter.length === 0) {
      toast.error("Can't remove your only sign-in method")

      return
    }

    setDisconnecting(providerId)
    try {
      const res = await fetch("/api/profile/me/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Failed to disconnect")

        return
      }
      setAccounts((prev) => prev.filter((a) => a.providerId !== providerId))
      toast.success(`${providerMeta(providerId).label} disconnected`)
    } catch {
      toast.error("Failed to disconnect")
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div>
      <h2
        style={{
          margin: "0 0 6px",
          fontSize: "16px",
          fontWeight: 600,
          color: T.ink.base,
        }}
      >
        Connected accounts
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: "13px", color: T.ink.faint }}>
        Sign-in methods linked to your account. You need at least one active
        method to stay signed in.
      </p>

      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: T.ink.faint,
              fontSize: "13px",
            }}
          >
            Loading…
          </div>
        ) : accounts.length === 0 ? (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: T.ink.faint,
              fontSize: "13px",
            }}
          >
            No linked accounts found
          </div>
        ) : (
          accounts.map((acct, i) => {
            const meta = providerMeta(acct.providerId)
            const isBusy = disconnecting === acct.providerId
            const isCredential = acct.providerId === "credential"
            // Can disconnect OAuth if: credential exists OR another OAuth remains after removal
            const remainingAfter = accounts.filter(
              (a) => a.providerId !== acct.providerId
            )
            const canDisconnect = !isCredential && remainingAfter.length > 0

            return (
              <div
                key={acct.id}
                style={{
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  borderBottom:
                    i < accounts.length - 1
                      ? `1px solid ${T.border.line}`
                      : "none",
                }}
              >
                {/* Provider icon */}
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${T.border.line}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon
                    icon={meta.icon}
                    width={16}
                    height={16}
                    style={{ color: T.ink.dim }}
                  />
                </div>

                {/* Label + identifier */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "13px", color: T.ink.base }}>
                    {meta.label}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: "11px",
                      color: T.ink.faint,
                      fontFamily: T.font.mono,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatAccountId(acct.accountId)}
                  </p>
                </div>

                {/* Action: disconnect button or primary badge */}
                {canDisconnect ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void disconnect(acct.providerId)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "6px",
                      border: `1px solid ${T.border.line}`,
                      background: "transparent",
                      color: T.ink.dim,
                      fontSize: "12px",
                      fontFamily: T.font.sans,
                      cursor: isBusy ? "not-allowed" : "pointer",
                      flexShrink: 0,
                      opacity: isBusy ? 0.5 : 1,
                    }}
                  >
                    {isBusy ? "Removing…" : "Disconnect"}
                  </button>
                ) : (
                  <span
                    title={
                      isCredential
                        ? "Your primary sign-in method. Manage password in Security."
                        : "Only remaining sign-in method — add another before removing"
                    }
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: `1px solid ${T.border.line}`,
                      fontSize: "11px",
                      fontFamily: T.font.mono,
                      letterSpacing: ".06em",
                      color: T.ink.faint,
                      flexShrink: 0,
                    }}
                  >
                    Primary
                  </span>
                )}
              </div>
            )
          })
        )}

        {/* Footer hint */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${T.border.line}`,
            fontSize: "11px",
            color: T.ink.faint,
            fontFamily: T.font.mono,
            letterSpacing: ".04em",
          }}
        >
          {!loading && !hasCredential && oauthAccounts.length <= 1
            ? "Only one sign-in method active — add another before disconnecting."
            : "Disconnecting removes the ability to sign in via that provider."}
        </div>
      </div>
    </div>
  )
}
