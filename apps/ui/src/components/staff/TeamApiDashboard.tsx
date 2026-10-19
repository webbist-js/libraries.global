"use client"

import { useLocale } from "next-intl"
import { useEffect, useState, useTransition } from "react"

import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"
import {
  API_SCOPES,
  type ApiDashboard,
  type ApiScope,
} from "@/lib/team-api/types"

import {
  ApiSubscriptionPanel,
  ApiUsagePanel,
  ApiGuidePanel,
} from "./TeamApiPanels"

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold disabled:opacity-50"
const INPUT = "min-h-11 rounded-xl border bg-white px-3 text-sm"
const count = (n: number) => n.toLocaleString("en-GB")
const bytes = (n: number) =>
  n >= 1024 ** 3
    ? `${(n / 1024 ** 3).toFixed(2)} GiB`
    : `${(n / 1024 ** 2).toFixed(2)} MiB`

const ERRORS: Record<string, string> = {
  api_terms_required:
    "The membership terms have changed. Reload this page and review them before subscribing.",
  organiser_required: "Ask a Team Organiser to manage API access.",
  api_key_limit_reached: "Revoke an unused key before creating another.",
  api_key_inactive: "This key has expired or been revoked. Create a new key.",
  api_addon_required: "Your Team needs an active API add-on to create keys.",
  api_subscription_already_exists:
    "Your Team already has an API subscription. Open billing to manage it.",
  api_payment_confirmation_pending:
    "Your payment is being confirmed. This page will update when it is ready.",
  too_many_requests: "Please wait a minute before trying again.",
  team_inactive: "Your Team is inactive. Contact us to renew it.",
}

export function TeamApiDashboard({
  initial,
  teams,
  confirming,
}: {
  readonly initial: ApiDashboard
  readonly teams: { id: string; name: string }[]
  readonly confirming: boolean
}) {
  const [data, setData] = useState(initial)
  const [error, setError] = useState("")
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [name, setName] = useState("")
  const [expires, setExpires] = useState("")
  const [scopes, setScopes] = useState<ApiScope[]>([...API_SCOPES])
  const [consent, setConsent] = useState(false)
  const [confirmation, setConfirmation] = useState<{
    action: "rotate" | "revoke"
    keyId: string
    name: string
  } | null>(null)
  const [pending, startTransition] = useTransition()
  const locale = useLocale(),
    router = useRouter()
  const endpoint = `/api/staff/team/${data.teamId}/api`
  const toggleScope = (scope: ApiScope, checked: boolean) =>
    setScopes((previous) =>
      checked
        ? [...previous, scope]
        : previous.filter((value) => value !== scope)
    )

  useEffect(() => {
    if ((!confirming && !data.pendingPayment) || data.active) return
    const controller = new AbortController()
    const interval = setInterval(() => {
      fetch(endpoint, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          if (response.ok) setData((await response.json()) as ApiDashboard)
        })
        .catch(() => {})
    }, 10_000)

    return () => {
      clearInterval(interval)
      controller.abort()
    }
  }, [confirming, data.active, data.pendingPayment, endpoint])

  const refresh = async () => {
    const response = await fetch(endpoint, { cache: "no-store" })
    if (!response.ok)
      throw new Error("Could not refresh API usage. Try again shortly.")
    setData((await response.json()) as ApiDashboard)
  }
  const request = (body: unknown) =>
    startTransition(async () => {
      setError("")
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const result = (await response.json()) as {
          error?: string
          secret?: string
          url?: string
        }
        if (!response.ok)
          throw new Error(
            ERRORS[result.error ?? ""] ??
              "API access is temporarily unavailable. Try again shortly."
          )
        if (result.url) {
          window.location.assign(result.url)

          return
        }
        if (result.secret) {
          setSecret(result.secret)
          setCopied(false)
          setName("")
        }
        setConfirmation(null)
        await refresh()
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Request failed. Please try again."
        )
      }
    })

  return (
    <div className="space-y-6" style={{ color: T.ink.base }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3">
          Team
          <select
            className={INPUT}
            value={data.teamId}
            onChange={(event) =>
              router.push(`/staff/team/api?team=${event.target.value}`)
            }
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={BUTTON}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await refresh()
                setError("")
              } catch {
                setError("Could not refresh API usage.")
              }
            })
          }
        >
          Refresh usage
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border p-4"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}
      <ApiSubscriptionPanel
        data={data}
        locale={locale}
        pending={pending}
        consent={consent}
        setConsent={setConsent}
        request={request}
        confirming={confirming}
      />
      <ApiUsagePanel data={data} locale={locale} />
      <section
        className="rounded-2xl border p-6"
        aria-labelledby="api-keys-title"
      >
        <h2
          id="api-keys-title"
          className="mb-4 text-2xl"
          style={{ fontFamily: T.font.serif }}
        >
          API keys
        </h2>
        {secret ? (
          <div className="mb-5 rounded-xl border p-4" role="status">
            <p className="mb-3 font-semibold">
              Copy this key now. It will not be shown again.
            </p>
            <code className="block rounded-lg bg-white p-3 break-all select-all">
              {secret}
            </code>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                className={BUTTON}
                onClick={() => {
                  navigator.clipboard
                    .writeText(secret)
                    .then(() => setCopied(true))
                    .catch(() =>
                      setError("Select the key above and copy it manually.")
                    )
                }}
              >
                {copied ? "Copied" : "Copy key"}
              </button>
              <button
                type="button"
                className={BUTTON}
                onClick={() => setSecret(null)}
              >
                I have saved it
              </button>
            </div>
          </div>
        ) : null}
        <ul className="space-y-4">
          {data.keys.map((key) => (
            <li key={key.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{key.name}</h3>
                  <p className="text-sm">
                    <code>{key.prefix}…</code> ·{" "}
                    {key.revokedAt
                      ? "Revoked"
                      : key.expiresAt && Date.parse(key.expiresAt) <= Date.now()
                        ? "Expired"
                        : "Active"}
                  </p>
                </div>
                {data.organiser && !key.revokedAt ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={BUTTON}
                      disabled={pending || !data.active}
                      onClick={() =>
                        setConfirmation({
                          action: "rotate",
                          keyId: key.id,
                          name: key.name,
                        })
                      }
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      className={BUTTON}
                      disabled={pending}
                      onClick={() =>
                        setConfirmation({
                          action: "revoke",
                          keyId: key.id,
                          name: key.name,
                        })
                      }
                    >
                      Revoke
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-sm">
                {key.scopes.join(", ")} · {count(key.requests)} requests ·{" "}
                {bytes(key.bytes)} this month
              </p>
              <p className="mt-1 text-sm">
                {key.lastUsedAt
                  ? `Last used ${new Date(key.lastUsedAt).toLocaleString(locale)}`
                  : "Never used"}
                {key.expiresAt
                  ? ` · Expires ${new Date(key.expiresAt).toLocaleDateString(locale)}`
                  : " · No expiry"}
              </p>
            </li>
          ))}
        </ul>
        {!data.keys.length ? <p>No keys have been created.</p> : null}
        {confirmation ? (
          <div
            className="mt-4 rounded-xl border p-4"
            role="group"
            aria-label="Confirm key change"
          >
            <p>
              {confirmation.action === "rotate"
                ? `Regenerate ${confirmation.name}? The old key will stop working immediately. Update every application using it.`
                : `Revoke ${confirmation.name}? Applications using it will stop working.`}
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                className={BUTTON}
                disabled={pending}
                onClick={() =>
                  request({
                    action: confirmation.action,
                    keyId: confirmation.keyId,
                  })
                }
              >
                Confirm
              </button>
              <button
                type="button"
                className={BUTTON}
                disabled={pending}
                onClick={() => setConfirmation(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {data.organiser && data.active ? (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (secret) {
                setError(
                  "Save or dismiss the current key before creating another."
                )

                return
              }
              request({
                action: "create",
                name,
                scopes,
                expiresAt: expires
                  ? new Date(`${expires}T23:59:59Z`).toISOString()
                  : null,
              })
            }}
          >
            <h3 className="font-semibold">Create a key</h3>
            <div className="flex flex-wrap gap-4">
              <label className="flex flex-col gap-2">
                Name
                <input
                  className={INPUT}
                  required
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Council website"
                />
              </label>
              <label className="flex flex-col gap-2">
                Expiry (optional)
                <input
                  className={INPUT}
                  type="date"
                  value={expires}
                  onChange={(event) => setExpires(event.target.value)}
                />
              </label>
            </div>
            <fieldset>
              <legend className="mb-2">Allowed APIs</legend>
              <div className="flex flex-wrap gap-4">
                {API_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={(event) =>
                        toggleScope(scope, event.target.checked)
                      }
                    />
                    {scope === "search:read"
                      ? "Library search"
                      : "Library records"}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              className={BUTTON}
              disabled={pending || !scopes.length || Boolean(secret)}
            >
              Create key
            </button>
          </form>
        ) : null}
      </section>
      <ApiGuidePanel />
    </div>
  )
}
