"use client"

import { useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"

export function DangerZoneSection({
  sessionUser,
}: {
  sessionUser: BetterAuthUser
}) {
  const [deactivateConfirm, setDeactivateConfirm] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [deleting, setDeleting] = useState(false)

  const handleDeactivate = async () => {
    setDeactivating(true)
    try {
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileVisibility: "private" }),
      })
      if (!res.ok) {
        toast.error("Failed to deactivate — please try again")

        return
      }
      toast.success("Account deactivated — signing you out")
      await authClient.signOut()
      globalThis.location.href = "/"
    } catch {
      toast.error("Failed to deactivate")
    } finally {
      setDeactivating(false)
    }
  }

  const handleDelete = async () => {
    if (deleteInput.trim().toLowerCase() !== sessionUser.email.toLowerCase()) {
      toast.error("Email doesn't match — please try again")

      return
    }
    setDeleting(true)
    try {
      const res = await fetch("/api/profile/me", { method: "DELETE" })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        toast.error(json.error ?? "Failed to delete account")

        return
      }
      // BA session is gone — hard-navigate away
      globalThis.location.href = "/?deleted=1"
    } catch {
      toast.error("Failed to delete account")
      setDeleting(false)
    }
  }

  const rowBorder = "1px solid rgba(255,100,100,0.12)"
  const dangerText = "rgba(255,140,140,0.9)"
  const dangerBtnStyle = {
    padding: "6px 14px",
    borderRadius: "6px",
    border: "1px solid rgba(255,100,100,0.3)",
    background: "rgba(255,100,100,0.06)",
    color: dangerText,
    fontSize: "12px",
    fontFamily: T.font.sans,
    cursor: "pointer" as const,
    flexShrink: 0,
    whiteSpace: "nowrap" as const,
  }
  const ghostBtnStyle = {
    padding: "6px 14px",
    borderRadius: "6px",
    border: `1px solid ${T.border.line}`,
    background: "transparent",
    color: T.ink.dim,
    fontSize: "12px",
    fontFamily: T.font.sans,
    cursor: "pointer" as const,
    flexShrink: 0,
    whiteSpace: "nowrap" as const,
  }

  return (
    <div>
      <h2
        style={{
          margin: "0 0 6px",
          fontSize: "16px",
          fontWeight: 600,
          color: T.accent.danger,
        }}
      >
        Danger zone
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: "13px", color: T.ink.faint }}>
        Irreversible actions. We&apos;ll always ask you to confirm before
        anything is removed.
      </p>

      <div
        style={{
          border: "1px solid rgba(255,100,100,0.2)",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {/* ── Export data (future) ── */}
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            borderBottom: rowBorder,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "13px", color: T.ink.base }}>
              Export my data
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "12px",
                color: T.ink.faint,
              }}
            >
              Download a JSON archive of your profile, contributions, and
              activity history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toast.info("Data export — coming soon")}
            style={ghostBtnStyle}
          >
            Request export
          </button>
        </div>

        {/* ── Deactivate ── */}
        <div style={{ borderBottom: rowBorder }}>
          {/* Main row */}
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "13px", color: dangerText }}>
                Deactivate account
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: T.ink.faint,
                }}
              >
                Hide your profile and pause notifications. Reversible — sign
                back in to reactivate.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeactivateConfirm((v) => !v)
                setDeleteConfirm(false)
              }}
              style={dangerBtnStyle}
            >
              Deactivate
            </button>
          </div>

          {/* Inline confirm */}
          {deactivateConfirm && (
            <div
              style={{
                padding: "14px 20px",
                borderTop: rowBorder,
                background: "rgba(255,100,100,0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: T.ink.faint,
                  lineHeight: 1.5,
                  maxWidth: "48ch",
                }}
              >
                Your profile will be set to private and you&apos;ll be signed
                out. You can reactivate any time by signing back in and updating
                your visibility.
              </p>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setDeactivateConfirm(false)}
                  style={ghostBtnStyle}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deactivating}
                  onClick={() => void handleDeactivate()}
                  style={{
                    ...dangerBtnStyle,
                    opacity: deactivating ? 0.6 : 1,
                    cursor: deactivating ? "not-allowed" : "pointer",
                  }}
                >
                  {deactivating ? "Deactivating…" : "Confirm deactivation"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Delete account ── */}
        <div>
          {/* Main row */}
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "13px", color: dangerText }}>
                Delete account
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: T.ink.faint,
                }}
              >
                Permanently remove your account and anonymise your
                contributions. This cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirm((v) => !v)
                setDeactivateConfirm(false)
                setDeleteInput("")
              }}
              style={dangerBtnStyle}
            >
              Delete account
            </button>
          </div>

          {/* Inline confirm */}
          {deleteConfirm && (
            <div
              style={{
                padding: "14px 20px",
                borderTop: rowBorder,
                background: "rgba(255,100,100,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: T.ink.faint,
                  lineHeight: 1.55,
                }}
              >
                All personal data will be permanently removed. Contributions you
                made to the atlas will be anonymised but retained. Type your
                email address to confirm:
              </p>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <input
                  type="email"
                  placeholder={sessionUser.email}
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,100,100,0.3)",
                    background: "rgba(255,100,100,0.04)",
                    color: T.ink.base,
                    fontSize: "12px",
                    fontFamily: T.font.sans,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  style={ghostBtnStyle}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    deleting ||
                    deleteInput.trim().toLowerCase() !==
                      sessionUser.email.toLowerCase()
                  }
                  onClick={() => void handleDelete()}
                  style={{
                    ...dangerBtnStyle,
                    opacity:
                      deleting ||
                      deleteInput.trim().toLowerCase() !==
                        sessionUser.email.toLowerCase()
                        ? 0.4
                        : 1,
                    cursor:
                      deleting ||
                      deleteInput.trim().toLowerCase() !==
                        sessionUser.email.toLowerCase()
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {deleting ? "Deleting…" : "Delete my account"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
