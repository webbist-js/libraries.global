"use client"
import { useTranslations } from "next-intl"
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
  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

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
        toast.error(
          tStatic("profileRoute.failed_to_hide_your_profile_please_try_again")
        )

        return
      }
      toast.success(tStatic("profileRoute.profile_hidden_signing_you_out"))
      await authClient.signOut()
      globalThis.location.href = "/"
    } catch {
      toast.error(tStatic("profileRoute.failed_to_deactivate"))
    } finally {
      setDeactivating(false)
    }
  }

  const handleDelete = async () => {
    if (deleteInput.trim().toLowerCase() !== sessionUser.email.toLowerCase()) {
      toast.error(tStatic("profileRoute.email_doesn_t_match_please_try_again"))

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
        toast.error(
          json.error ?? tStatic("profileRoute.failed_to_delete_account")
        )

        return
      }
      globalThis.location.href = "/?deleted=1"
    } catch {
      toast.error(tStatic("profileRoute.failed_to_delete_account"))
      setDeleting(false)
    }
  }

  const emailMatches =
    deleteInput.trim().toLowerCase() === sessionUser.email.toLowerCase()

  return (
    <SectionCard
      id="data"
      title={tUi("your_data_account")}
      lead={tStatic(
        "profileRoute.download_your_account_summary_request_a_complete_personal_data_copy_or_delete_your_account"
      )}
    >
      <div>
        {/* Download */}
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <p
              className="m-0 text-base font-medium"
              style={{ color: T.ink.base }}
            >
              {tStatic("profileRoute.download_your_data")}
            </p>
            <p className="m-0 mt-0.5 text-sm" style={{ color: T.ink.dim }}>
              {tStatic(
                "profileRoute.a_json_summary_of_your_profile_preferences_account_and_api_access_consents_for_a_complete_personal_d"
              )}
            </p>
          </div>
          <a
            href="/api/profile/me/export"
            download
            style={{ ...pillButton, textDecoration: "none" }}
          >
            {tStatic("profileRoute.request_download")}
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
                  {tStatic("profileRoute.hide_profile_and_sign_out")}
                </p>
                <p className="m-0 mt-0.5 text-sm" style={{ color: T.ink.dim }}>
                  {tStatic(
                    "profileRoute.makes_your_profile_private_and_signs_you_out_change_your_email_preferences_above_before_signing_out"
                  )}
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
                {tStatic("profileRoute.hide_profile")}
              </button>
            </div>
            {deactivateConfirm ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                <p
                  className="m-0 max-w-[52ch] text-sm leading-[1.5]"
                  style={{ color: T.ink.dim }}
                >
                  {tStatic(
                    "profileRoute.your_profile_will_be_set_to_private_and_you_rsquo_ll_be_signed_out_sign_back_in_any_time_to_update_y"
                  )}
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
                    {deactivating
                      ? tUi("saving")
                      : tStatic("profileRoute.hide_profile_and_sign_out")}
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
                  {tStatic("profileRoute.delete_account")}
                </p>
                <p className="m-0 mt-0.5 text-sm" style={{ color: T.ink.dim }}>
                  {tStatic(
                    "profileRoute.permanently_removes_your_account_accepted_contributions_stay_in_the_index_credited_to_ldquo_a_former"
                  )}
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
                {tStatic("profileRoute.delete_account_prompt")}
              </button>
            </div>
            {deleteConfirm ? (
              <div className="flex flex-col gap-3 pb-4">
                <p
                  className="m-0 text-sm leading-[1.5]"
                  style={{ color: T.ink.dim }}
                >
                  {tStatic(
                    "profileRoute.all_personal_data_will_be_permanently_removed_type_your_email_address_to_confirm"
                  )}
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
