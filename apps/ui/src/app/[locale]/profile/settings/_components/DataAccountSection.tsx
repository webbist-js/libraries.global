"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

import { SectionCard } from "@/components/profile-form/FormParts"
import { authClient } from "@/lib/auth-client"
import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { redirectForReauthentication } from "@/lib/fresh-auth"

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

export function DataAccountSection({
  sessionUser,
}: {
  sessionUser: BetterAuthUser
}) {
  const tUi = useUiTranslations("ui")

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
        toast.error("Failed to hide your profile — please try again")

        return
      }
      toast.success("Profile hidden — signing you out")
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
        const json = (await res.json()) as {
          error?: string
          reauthUrl?: string
        }
        if (redirectForReauthentication(json)) return
        toast.error(json.error ?? "Failed to delete account")

        return
      }
      globalThis.location.href = "/?deleted=1"
    } catch {
      toast.error("Failed to delete account")
      setDeleting(false)
    }
  }

  const emailMatches =
    deleteInput.trim().toLowerCase() === sessionUser.email.toLowerCase()

  return (
    <SectionCard
      id="data"
      title={tUi("your_data_account")}
      lead="Download your account summary, request a complete personal-data copy, or delete your account."
    >
      <div>
        {/* Download */}
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <p
              className="m-0 text-base font-medium"
              style={{ color: T.ink.base }}
            >
              Download your data
            </p>
            <p className="m-0 mt-0.5 text-sm" style={{ color: T.ink.dim }}>
              A JSON summary of your profile, preferences, account and billing
              details. For a complete personal-data copy, contact
              legal@libraries.global.
            </p>
          </div>
          <a
            href="/api/profile/me/export"
            download
            style={{ ...pillButton, textDecoration: "none" }}
          >
            Request download
          </a>
        </div>

        {/* Danger zone */}
        <div
          className="rounded-[16px] border"
          style={{
            borderColor: "var(--t-danger-edge)",
            background: "var(--t-danger-soft)",
          }}
        >
          {/* Deactivate */}
          <div
            className="px-5"
            style={{ borderBottom: "1px solid var(--t-danger-edge)" }}
          >
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p
                  className="m-0 text-base font-semibold"
                  style={{ color: T.accent.danger }}
                >
                  Hide profile and sign out
                </p>
                <p className="m-0 mt-0.5 text-sm" style={{ color: T.ink.dim }}>
                  Makes your profile private and signs you out. Change your
                  email preferences above before signing out.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeactivateConfirm((v) => !v)
                  setDeleteConfirm(false)
                }}
                style={pillButton}
              >
                Hide profile
              </button>
            </div>
            {deactivateConfirm ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                <p
                  className="m-0 max-w-[52ch] text-sm leading-[1.5]"
                  style={{ color: T.ink.dim }}
                >
                  Your profile will be set to private and you&rsquo;ll be signed
                  out. Sign back in any time to update your visibility. Your
                  email preferences stay as you set them.
                </p>
                <div className="flex shrink-0 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeactivateConfirm(false)}
                    style={pillButton}
                  >
                    {tUi("cancel")}{" "}
                  </button>
                  <button
                    type="button"
                    disabled={deactivating}
                    onClick={() => void handleDeactivate()}
                    style={{
                      ...pillButton,
                      border: "none",
                      background: T.action.danger,
                      color: "#fff",
                      opacity: deactivating ? 0.6 : 1,
                    }}
                  >
                    {deactivating ? tUi("saving") : "Hide profile and sign out"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Delete */}
          <div className="px-5">
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p
                  className="m-0 text-base font-semibold"
                  style={{ color: T.accent.danger }}
                >
                  Delete account
                </p>
                <p className="m-0 mt-0.5 text-sm" style={{ color: T.ink.dim }}>
                  Permanently removes your account. Accepted contributions stay
                  in the index, credited to &ldquo;a former contributor&rdquo;.
                  This can&rsquo;t be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirm((v) => !v)
                  setDeactivateConfirm(false)
                  setDeleteInput("")
                }}
                style={{
                  ...pillButton,
                  border: "none",
                  background: T.action.danger,
                  color: "#fff",
                }}
              >
                Delete account…
              </button>
            </div>
            {deleteConfirm ? (
              <div className="flex flex-col gap-3 pb-4">
                <p
                  className="m-0 text-sm leading-[1.5]"
                  style={{ color: T.ink.dim }}
                >
                  All personal data will be permanently removed. Type your email
                  address to confirm:
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    type="email"
                    placeholder={sessionUser.email}
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    className="min-w-0 flex-1 rounded-[12px] border px-3.5 py-2 text-sm"
                    style={{
                      borderColor: "var(--t-danger-edge)",
                      background: T.bg.deep,
                      color: T.ink.base,
                      fontFamily: T.font.sans,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(false)}
                    style={pillButton}
                  >
                    {tUi("cancel")}{" "}
                  </button>
                  <button
                    type="button"
                    disabled={deleting || !emailMatches}
                    onClick={() => void handleDelete()}
                    style={{
                      ...pillButton,
                      border: "none",
                      background: T.action.danger,
                      color: "#fff",
                      opacity: deleting || !emailMatches ? 0.45 : 1,
                      cursor:
                        deleting || !emailMatches ? "not-allowed" : "pointer",
                    }}
                  >
                    {deleting ? "Deleting…" : "Delete my account"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
