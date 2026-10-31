"use client"

import { Icon } from "@iconify/react"
import { useLocale, useTranslations } from "next-intl"
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react"

import { Badge } from "@/components/ds/Badge"
import { Notice } from "@/components/ds/Notice"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { TeamApiKeyDialog } from "@/components/staff/TeamApiKeyDialog"
import { TeamPurchaseProgress } from "@/components/staff/TeamPurchaseJourney"
import { Button } from "@/components/ui/button"
import { captureCheckoutAttempt } from "@/lib/checkout-analytics"
import { Link } from "@/lib/navigation"
import type { ApiDashboard } from "@/lib/team-api/types"
import {
  rememberTeamApiChoice,
  teamApiChoiceSelected,
} from "@/lib/team-purchase-intent"

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

function activeApiKeyCount(data: ApiDashboard, now: number) {
  return (
    data.keyPage?.activeCount ??
    data.keys.filter(
      (key) =>
        !key.revokedAt && (!key.expiresAt || Date.parse(key.expiresAt) > now)
    ).length
  )
}

function hasApiUsage(data: ApiDashboard) {
  return Boolean(
    data.active ||
    data.membership ||
    data.days.length ||
    data.usage.requests ||
    data.usage.bytes
  )
}
function hasApiKeys(data: ApiDashboard) {
  return Boolean(data.active || data.membership || data.keys.length)
}
function canCreateApiKeys(data: ApiDashboard) {
  return data.organiser && data.active
}

function KeyPagination({
  page,
  count,
  pending,
  onPage,
}: {
  page: ApiDashboard["keyPage"]
  count: number
  pending: boolean
  onPage: (offset: number) => void
}) {
  if (!page || (page.offset === 0 && !page.hasMore)) return null

  return (
    <nav
      aria-label="API key pages"
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <span className="text-sm text-(--t-ink-dim)">
        Keys {page.offset + 1}–{page.offset + count}
      </span>
      <div className="flex gap-2">
        <Button
          variant="surface"
          size="pill"
          disabled={pending || page.offset === 0}
          onClick={() => onPage(Math.max(0, page.offset - 50))}
        >
          Previous
        </Button>
        <Button
          variant="surface"
          size="pill"
          disabled={pending || !page.hasMore}
          onClick={() => onPage(page.offset + 50)}
        >
          Next
        </Button>
      </div>
    </nav>
  )
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
                      <h3 className="type-small-heading m-0 break-words">
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
                        className="rounded bg-(--t-bg-muted) px-2 py-0.5 font-mono text-sm break-all"
                      >
                        {key.prefix}…
                      </code>
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          translate="no"
                          className="rounded-full border border-(--t-border-line) px-2 py-0.5 font-mono text-sm text-(--t-ink-dim)"
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
                        className="px-3.5 py-2 text-sm"
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
                        className="px-3.5 py-2 text-sm text-(--t-accent-danger)"
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
                <p className="mt-3 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
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
            <h3 className="type-h3 m-0">{t("emptyTitle")}</h3>
            <p className="mt-2 mb-0 max-w-[65ch] text-base leading-relaxed text-(--t-ink-dim)">
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
      <p className="m-0 text-base font-semibold">
        {confirmation.action === "rotate"
          ? "Regenerate " + confirmation.name + "?"
          : "Revoke " + confirmation.name + "?"}
      </p>
      <p className="mt-2 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
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

function ApiDashboardHeader({
  data,
  subscription,
  pending,
  onRefresh,
}: {
  data: Pick<ApiDashboard, "active" | "teamName">
  subscription: ReactNode
  pending: boolean
  onRefresh: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {data.active ? (
        <div className="min-w-0 flex-1">{subscription}</div>
      ) : (
        <p className="m-0 text-base text-(--t-ink-dim)">
          API access for {data.teamName}
        </p>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="surface"
          size="pill"
          disabled={pending}
          aria-busy={pending}
          className="px-4 py-2"
          onClick={onRefresh}
        >
          <Icon icon="mdi:refresh" aria-hidden="true" width={17} height={17} />
          Refresh usage
        </Button>
      </div>
    </div>
  )
}

function ApiKeySecret({
  secret,
  copied,
  fieldRef,
  onCopied,
  onCopyError,
  onDismiss,
}: {
  secret: string
  copied: boolean
  fieldRef: RefObject<HTMLDivElement | null>
  onCopied: () => void
  onCopyError: () => void
  onDismiss: () => void
}) {
  const t = useTranslations("teamApiKeys")

  return (
    <div
      ref={fieldRef}
      tabIndex={-1}
      className="mb-5 rounded-2xl border border-(--t-accent-primary)/25 bg-(--t-action-primary)/5 p-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) sm:p-5"
      role="status"
    >
      <p className="mt-0 mb-3 text-base font-semibold">{t("copyNow")}</p>
      <code
        translate="no"
        className="block rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) p-4 font-mono text-sm break-all select-all"
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
              .then(() => onCopied())
              .catch(() => onCopyError())
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
          onClick={() => onDismiss()}
        >
          {t("saved")}
        </Button>
      </div>
    </div>
  )
}

function apiDashboardVisibility(
  data: ApiDashboard,
  section: string,
  guided: boolean,
  setupRequested: boolean
) {
  return {
    progress: guided && data.organiser && ["all", "overview"].includes(section),
    stage: data.active
      ? ("complete" as const)
      : data.teamActive
        ? ("api" as const)
        : ("team" as const),
    summary: hasApiUsage(data) && section === "overview",
    usage: hasApiUsage(data) && ["all", "usage"].includes(section),
    keys: hasApiKeys(data) && ["all", "keys"].includes(section),
    setup: setupRequested && data.organiser,
  }
}

export function TeamApiDashboard({
  initial,
  confirming,
  setupRequested = false,
  section = "all",
}: {
  readonly section?: "all" | "overview" | "keys" | "usage"
  readonly setupRequested?: boolean
  readonly initial: ApiDashboard
  readonly confirming: boolean
}) {
  const [guided, setGuided] = useState(setupRequested)
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
  const locale = useLocale()
  const endpoint = `/api/staff/team/${data.teamId}/api`

  useEffect(() => {
    if (!data.organiser) return
    const selected = setupRequested || teamApiChoiceSelected(data.teamId)
    if (selected) setGuided(true)
    if (data.active) rememberTeamApiChoice(data.teamId, false)
  }, [data.teamId, data.organiser, data.active, setupRequested])

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

  const refresh = async (keyOffset = data.keyPage?.offset ?? 0) => {
    const response = await fetch(`${endpoint}?keyOffset=${keyOffset}`, {
      cache: "no-store",
    })
    if (!response.ok)
      throw new Error("Could not refresh API usage. Try again shortly.")
    setData((await response.json()) as ApiDashboard)
    setNow(Date.now())
  }
  const request = (body: unknown) =>
    startTransition(async () => {
      const fields = { product: "team_api", billing_interval: "month" } as const
      const { handoff, failed } = captureCheckoutAttempt(body, fields)
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
          handoff()
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
        failed()
        setError(
          failure instanceof Error
            ? failure.message
            : "Request failed. Please try again."
        )
      }
    })

  const activeKeys = activeApiKeyCount(data, now)
  const visibility = apiDashboardVisibility(
    data,
    section,
    guided,
    setupRequested
  )
  const subscription = (
    <ApiSubscriptionPanel
      data={data}
      locale={locale}
      pending={pending}
      error={error}
      clearError={() => setError("")}
      request={request}
      confirming={confirming}
      setupRequested={visibility.setup}
    />
  )

  const handleRefresh = () =>
    startTransition(async () => {
      try {
        await refresh()
        setError("")
      } catch {
        setError("Could not refresh API usage. Try again shortly.")
      }
    })

  return (
    <div className="min-w-0 space-y-6 text-(--t-ink-base)">
      {visibility.progress ? (
        <TeamPurchaseProgress stage={visibility.stage} />
      ) : null}
      <ApiDashboardHeader
        data={data}
        subscription={subscription}
        pending={pending}
        onRefresh={handleRefresh}
      />
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
      {visibility.summary ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-(--t-ink-dim) tabular-nums">
          <span>
            This month:{" "}
            {new Intl.NumberFormat(locale).format(data.usage.requests)} of{" "}
            {new Intl.NumberFormat(locale).format(data.limits.requests)}{" "}
            successful requests
          </span>
          <span>
            {formatApiBytes(data.usage.bytes, locale)} of{" "}
            {formatApiBytes(data.limits.bytes, locale)} response data
          </span>
          <Link
            href="/developers/usage"
            className="inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary) underline underline-offset-4"
          >
            View usage and reset date
          </Link>
        </div>
      ) : null}
      {visibility.usage ? <ApiUsagePanel data={data} locale={locale} /> : null}
      {visibility.keys ? (
        <StaffPanel
          title={t("title")}
          id="api-keys"
          aside={
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-(--t-bg-surface) px-3 py-1.5 text-sm text-(--t-ink-dim) tabular-nums">
                {t("activeCount", { count: activeKeys })}
              </span>
              {canCreateApiKeys(data) ? (
                <TeamApiKeyDialog
                  open={keyCreationOpen}
                  onOpenChange={(open) => {
                    setKeyCreationOpen(open)
                    setError("")
                  }}
                  pending={pending}
                  disabled={Boolean(secret)}
                  error={error}
                  onCreate={(draft) => {
                    if (pending || secret) return

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
          <p className="mt-0 mb-5 max-w-[70ch] text-base leading-relaxed text-(--t-ink-dim)">
            {t("intro")}
          </p>
          {secret ? (
            <ApiKeySecret
              secret={secret}
              copied={copied}
              fieldRef={secretRef}
              onCopied={() => setCopied(true)}
              onCopyError={() =>
                setError("Select the key above and copy it manually.")
              }
              onDismiss={() => setSecret(null)}
            />
          ) : null}
          <TeamKeyList
            data={data}
            now={now}
            secret={secret}
            locale={locale}
            pending={pending}
            setConfirmation={setConfirmation}
          />
          <KeyPagination
            page={data.keyPage}
            count={data.keys.length}
            pending={pending}
            onPage={(offset) =>
              startTransition(async () => {
                try {
                  await refresh(offset)
                } catch {
                  setError("Could not load keys. Try again.")
                }
              })
            }
          />
          <KeyChangeConfirmation
            confirmation={confirmation}
            pending={pending}
            request={request}
            onCancel={() => setConfirmation(null)}
          />
        </StaffPanel>
      ) : null}
      {section === "all" ? <ApiGuidePanel /> : null}
    </div>
  )
}
