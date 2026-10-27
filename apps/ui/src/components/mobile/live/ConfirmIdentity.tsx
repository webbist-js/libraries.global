"use client"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { Sheet } from "@/components/ds/Sheet"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

import { ConfirmIdentityLook } from "./LiveConsoleScreens"

export async function liveRequest<T>(
  path: string,
  body?: unknown,
  token?: string,
  method = "POST"
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Live-Token": token } : {}),
    },
    ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}),
    cache: "no-store",
  })
  const value = await response.json()
  if (!response.ok)
    throw new Error(value.error?.code ?? "live_service_unavailable")

  return value as T
}
export function ConfirmIdentity({
  open,
  onClose,
  onConfirmed,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly onConfirmed: () => void
}) {
  const tUi = useUiTranslations("ui")

  const [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const codeRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (sent) codeRef.current?.focus()
  }, [sent])
  async function confirm(method: "password" | "code" | "passkey") {
    setBusy(true)
    setError("")
    try {
      if (method === "passkey") {
        const result = await authClient.signIn.passkey({
          fetchOptions: { headers: { "X-Live-Confirm": "true" } },
        })
        if (result.error)
          throw new Error(result.error.message ?? "confirmation_failed")
      }
      await liveRequest("/api/mobile/live/confirm", {
        method,
        password: method === "password" ? password : undefined,
        code: method === "code" ? code : undefined,
      })
      setPassword("")
      setCode("")
      onConfirmed()
    } catch (e) {
      setError(
        (e as Error).message === "confirmation_locked"
          ? "Five attempts failed. Try again in 15 minutes."
          : "That confirmation did not work. Try another method."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={tUi("confirm_its_you")}
      side="bottom"
    >
      <ConfirmIdentityLook showTitle={false}>
        {error && (
          <p role="alert" style={{ color: T.accent.danger }}>
            {error}
          </p>
        )}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void confirm("password")
          }}
        >
          <label className="block text-base font-semibold">
            {tUi("password")}{" "}
            <input
              className="live-input mt-2 font-normal"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            className="live-button live-primary rounded-full"
            disabled={busy || !password}
          >
            Confirm
          </button>
        </form>
        <button
          type="button"
          disabled={busy}
          className="live-button rounded-full"
          onClick={() => confirm("passkey")}
        >
          Use a passkey
        </button>
        <button
          type="button"
          className="live-button rounded-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await liveRequest("/api/mobile/live/confirm/code", {})
              setSent(true)
              setError("")
            } catch {
              setError(
                "The code could not be sent. Check that your email address is verified, then try again."
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          Email me a code
        </button>
        {sent && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void confirm("code")
            }}
          >
            <label className="block text-base font-semibold">
              Six-digit code
              <input
                ref={codeRef}
                className="live-input mt-2 font-normal"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replaceAll(/\D/g, ""))}
              />
            </label>
            <button
              className="live-button rounded-full"
              disabled={busy || code.length !== 6}
            >
              Confirm with code
            </button>
          </form>
        )}
        <button
          type="button"
          className="mx-auto block min-h-11 text-base font-semibold"
          style={{ color: T.ink.dim }}
          onClick={onClose}
        >
          {tUi("cancel")}{" "}
        </button>
        <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
          Confirmation lasts 12 hours on this sign-in. After confirming, you can
          add a passkey to this account.
        </p>
      </ConfirmIdentityLook>
    </Sheet>
  )
}
