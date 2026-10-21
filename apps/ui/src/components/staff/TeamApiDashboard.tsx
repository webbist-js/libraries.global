"use client"

import { Icon } from "@iconify/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState, useTransition } from "react"

import { Badge } from "@/components/ds/Badge"
import { Notice } from "@/components/ds/Notice"
import { SelectField } from "@/components/ds/SelectField"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { TeamApiKeyDialog } from "@/components/staff/TeamApiKeyDialog"
import { Button } from "@/components/ui/button"
import { useRouter } from "@/lib/navigation"
import type { ApiDashboard } from "@/lib/team-api/types"

import {
  ApiSubscriptionPanel,
  ApiUsagePanel,
  ApiGuidePanel,
  formatApiBytes,
} from "./TeamApiPanels"

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

type KeyChange = { action: "rotate" | "revoke"; keyId: string; name: string }
function TeamKeyList({
  data,
  now,
  secret,
  locale,
  pending,
  setConfirmation,
}: {
  data: ApiDashboard
  now: number
  secret: string | null
  locale: string
  pending: boolean
  setConfirmation: (change: KeyChange | null) => void
}) {
  const t = useTranslations("teamApiKeys")
  const count = (value: number) => new Intl.NumberFormat(locale).format(value)

  return (
    <>
      {" "}
      {data.keys.length ? (
        <ul className="m-0 grid list-none gap-3 p-0">
          {data.keys.map((key) => {
            const expired = Boolean(
              key.expiresAt && Date.parse(key.expiresAt) <= now
            )
            const status = key.revokedAt
              ? "Revoked"
              : expired
                ? "Expired"
                : "Active"

            return (
              <li
                key={key.id}
                className={
                  "min-w-0 rounded-2xl border border-(--t-border-line) p-4 " +
                  (status === "Active"
                    ? "bg-(--t-bg-deep)"
                    : "bg-(--t-bg-surface)")
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="m-0 text-[16px] font-semibold break-words">
                        {key.name}
                      </h3>
                      <Badge
                        label={status}
                        color={status === "Active" ? "ok" : "dim"}
                        dot={status === "Active"}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code
                        translate="no"
                        className="rounded bg-(--t-bg-muted) px-2 py-0.5 font-mono text-[13px] break-all"
                      >
                        {key.prefix}…
                      </code>
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          translate="no"
                          className="rounded-full border border-(--t-border-line) px-2 py-0.5 font-mono text-[13px] text-(--t-ink-dim)"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                  {data.organiser && !key.revokedAt ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="surface"
                        size="pill"
                        className="px-3.5 py-2 text-[14px]"
                        disabled={
                          pending || !data.active || expired || Boolean(secret)
                        }
                        onClick={() =>
                          setConfirmation({
                            action: "rotate",
                            keyId: key.id,
                            name: key.name,
                          })
                        }
                      >
                        Regenerate
                      </Button>
                      <Button
                        type="button"
                        variant="surface"
                        size="pill"
                        className="px-3.5 py-2 text-[14px] text-(--t-accent-danger)"
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
                      </Button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 mb-0 text-[14px] leading-relaxed text-(--t-ink-dim)">
                  {count(key.requests)} requests ·{" "}
                  {formatApiBytes(key.bytes, locale)} this month ·{" "}
                  {key.lastUsedAt
                    ? "Last used " +
                      new Date(key.lastUsedAt).toLocaleString(locale)
                    : "Never used"}
                  {key.expiresAt
                    ? " · Expires " +
                      new Date(key.expiresAt).toLocaleDateString(locale)
                    : " · No expiry"}
                </p>
              </li>
            )
          })}
        </ul>
      ) : secret ? null : (
        <div className="flex items-start gap-4 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-5 sm:p-6">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-(--t-bg-deep) text-(--t-accent-primary)">
            <Icon aria-hidden="true" icon="mdi:key-outline" width={23} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 font-serif text-[24px] leading-tight">
              {t("emptyTitle")}
            </h3>
            <p className="mt-2 mb-0 max-w-[65ch] text-[15px] leading-relaxed text-(--t-ink-dim)">
              {t(
                !data.organiser
                  ? "emptyMember"
                  : data.active
                    ? "emptyOrganiser"
                    : "emptyInactive"
              )}
            </p>
          </div>
        </div>
      )}
    </>
  )
}

function KeyChangeConfirmation({
  confirmation,
  pending,
  request,
  onCancel,
}: {
  confirmation: KeyChange | null
  pending: boolean
  request: (body: unknown) => void
  onCancel: () => void
}) {
  if (!confirmation) return null

  return (
    <div
      className="mt-5 rounded-2xl border border-(--t-border-hi) bg-(--t-bg-surface) p-5"
      role="group"
      aria-label="Confirm key change"
    >
      <p className="m-0 text-[16px] font-semibold">
        {confirmation.action === "rotate"
          ? "Regenerate " + confirmation.name + "?"
          : "Revoke " + confirmation.name + "?"}
      </p>
      <p className="mt-2 mb-0 text-[15px] leading-relaxed text-(--t-ink-dim)">
        {confirmation.action === "rotate"
          ? "The old key will stop working immediately. Update every application using it."
          : "Applications using it will stop working."}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="primary"
          size="pill"
          disabled={pending}
          onClick={() =>
            request({
              action: confirmation.action,
              keyId: confirmation.keyId,
            })
          }
        >
          Confirm
        </Button>
        <Button
          type="button"
          variant="surface"
          size="pill"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
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
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState("")
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [keyCreationOpen, setKeyCreationOpen] = useState(false)
  const secretRef = useRef<HTMLDivElement>(null)
  const t = useTranslations("teamApiKeys")
  const [confirmation, setConfirmation] = useState<KeyChange | null>(null)
  const [pending, startTransition] = useTransition()
  const locale = useLocale(),
    router = useRouter()
  const endpoint = `/api/staff/team/${data.teamId}/api`

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
    setNow(Date.now())
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
          setKeyCreationOpen(false)
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

  const activeKeys = data.keys.filter(
    (key) =>
      !key.revokedAt && (!key.expiresAt || Date.parse(key.expiresAt) > now)
  ).length
  const atLimit = activeKeys >= data.limits.keys
  const subscription = (
    <ApiSubscriptionPanel
      data={data}
      locale={locale}
      pending={pending}
      error={error}
      clearError={() => setError("")}
      request={request}
      confirming={confirming}
    />
  )

  return (
    <div className="min-w-0 space-y-6 text-(--t-ink-base)">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {data.active ? (
          <div className="min-w-0 flex-1">{subscription}</div>
        ) : (
          <p className="m-0 text-[15px] text-(--t-ink-dim)">
            API access for {data.teamName}
          </p>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {teams.length > 1 ? (
            <div className="w-full sm:w-60">
              <SelectField
                label="Team"
                value={data.teamId}
                options={teams.map((team) => ({
                  value: team.id,
                  label: team.name,
                }))}
                onValueChange={(value) =>
                  router.push(
                    "/staff/team/api?team=" + encodeURIComponent(value)
                  )
                }
              />
            </div>
          ) : null}
          <Button
            type="button"
            variant="surface"
            size="pill"
            disabled={pending}
            aria-busy={pending}
            className="px-4 py-2"
            onClick={() =>
              startTransition(async () => {
                try {
                  await refresh()
                  setError("")
                } catch {
                  setError("Could not refresh API usage. Try again shortly.")
                }
              })
            }
          >
            <Icon
              icon="mdi:refresh"
              aria-hidden="true"
              width={17}
              height={17}
            />
            Refresh usage
          </Button>
        </div>
      </div>
      {error ? (
        <Notice
          tone="warn"
          title="API request not completed"
          icon="mdi:alert-circle-outline"
        >
          <span role="alert">{error}</span>
        </Notice>
      ) : null}
      {!data.active ? subscription : null}
      <ApiUsagePanel data={data} locale={locale} />
      <StaffPanel
        title={t("title")}
        id="api-keys"
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-(--t-bg-surface) px-3 py-1.5 text-[14px] text-(--t-ink-dim) tabular-nums">
              {t("activeCount", { count: activeKeys, limit: data.limits.keys })}
            </span>
            {data.organiser && data.active ? (
              <TeamApiKeyDialog
                open={keyCreationOpen}
                onOpenChange={(open) => {
                  setKeyCreationOpen(open)
                  setError("")
                }}
                pending={pending}
                disabled={Boolean(secret) || atLimit}
                error={error}
                onCreate={(draft) => {
                  if (pending || secret || atLimit) return

                  request({ action: "create", ...draft })
                }}
                focusSecret={() => {
                  if (!secretRef.current) return false
                  secretRef.current.focus()

                  return true
                }}
              />
            ) : null}
          </div>
        }
      >
        <p className="mt-0 mb-5 max-w-[70ch] text-[15px] leading-relaxed text-(--t-ink-dim)">
          {t("intro")}
        </p>
        {secret ? (
          <div
            ref={secretRef}
            tabIndex={-1}
            className="mb-5 rounded-2xl border border-(--t-accent-primary)/25 bg-(--t-accent-primary)/5 p-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) sm:p-5"
            role="status"
          >
            <p className="mt-0 mb-3 text-[16px] font-semibold">
              {t("copyNow")}
            </p>
            <code
              translate="no"
              className="block rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) p-4 font-mono text-[14px] break-all select-all"
            >
              {secret}
            </code>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="primary"
                size="pill"
                onClick={() =>
                  navigator.clipboard
                    .writeText(secret)
                    .then(() => setCopied(true))
                    .catch(() =>
                      setError("Select the key above and copy it manually.")
                    )
                }
              >
                <Icon
                  aria-hidden="true"
                  icon={copied ? "mdi:check" : "mdi:content-copy"}
                />
                {t(copied ? "copied" : "copyKey")}
              </Button>
              <Button
                type="button"
                variant="surface"
                size="pill"
                onClick={() => setSecret(null)}
              >
                {t("saved")}
              </Button>
            </div>
          </div>
        ) : null}
        <TeamKeyList
          data={data}
          now={now}
          secret={secret}
          locale={locale}
          pending={pending}
          setConfirmation={setConfirmation}
        />
        {data.organiser && data.active && atLimit ? (
          <p
            role="status"
            className="mt-4 mb-0 text-[15px] leading-relaxed text-(--t-ink-dim)"
          >
            {t("atLimit", { count: data.limits.keys })}
          </p>
        ) : null}
        <KeyChangeConfirmation
          confirmation={confirmation}
          pending={pending}
          request={request}
          onCancel={() => setConfirmation(null)}
        />
      </StaffPanel>
      <ApiGuidePanel />
    </div>
  )
}
