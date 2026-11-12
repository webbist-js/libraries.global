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
import { ApiOveragePanel } from "@/components/staff/ApiOveragePanel"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { TeamApiKeyDialog } from "@/components/staff/TeamApiKeyDialog"
import { Button } from "@/components/ui/button"
import { captureCheckoutAttempt } from "@/lib/checkout-analytics"
import { redirectForReauthentication } from "@/lib/fresh-auth"
import { Link } from "@/lib/navigation"
import type { ApiDashboard } from "@/lib/team-api/types"

import {
  ApiSubscriptionPanel,
  ApiUsagePanel,
  ApiGuidePanel,
  formatApiBytes,
  formatPeriodTime,
  warningSummary,
} from "./TeamApiPanels"

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

function ApiUsageSummary({
  data,
  locale,
}: {
  readonly data: ApiDashboard
  readonly locale: string
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const count = (n: number) => new Intl.NumberFormat(locale).format(n)
  const warnings = warningSummary(data.warnings)

  return (
    <section
      aria-label={tStatic("staff.current_billing_period")}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-h3 m-0">{tStatic("staff.this_billing_period")}</h2>
        <Link
          href="/developers/usage"
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-(--t-accent-primary) underline underline-offset-4"
        >
          {tStatic("staff.view_usage")} <span aria-hidden>→</span>
        </Link>
      </div>
      <dl className="m-0 grid gap-4 md:grid-cols-3">
        {[
          {
            label: tExisting("teamApiSubscription.requests"),
            used: data.usage.requests,
            limit: data.limits.requests,
            format: count,
          },
          {
            label: tExisting("teamApiSubscription.responseData"),
            used: data.usage.bytes,
            limit: data.limits.bytes,
            format: (n: number) => formatApiBytes(n, locale),
          },
          {
            label: tExisting("teamApiSubscription.credits"),
            used: data.usage.credits,
            limit: data.limits.analysisCredits,
            format: count,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-5"
          >
            <dt className="text-sm font-semibold text-(--t-ink-dim)">
              {metric.label}
            </dt>
            <dd className="m-0 mt-3">
              <span className="type-stat block tabular-nums">
                {metric.format(metric.used)}
              </span>
              <span className="mt-2 block text-sm text-(--t-ink-dim)">
                {tExisting("widgetPublic.of")} {metric.format(metric.limit)}{" "}
                included
              </span>
              <div
                aria-hidden
                className="mt-4 h-1.5 overflow-hidden rounded-full bg-(--t-bg-muted)"
              >
                <div
                  className="h-full rounded-full bg-(--t-accent-primary)"
                  style={{
                    width: `${Math.min(100, Math.max(0, metric.limit > 0 ? (metric.used / metric.limit) * 100 : 0))}%`,
                  }}
                />
              </div>
            </dd>
          </div>
        ))}
      </dl>
      {data.usage.resetsAt ? (
        <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
          {tStatic("staff.allowance_resets")}{" "}
          {formatPeriodTime(data.usage.resetsAt, locale)}{" "}
          {tStatic("staff.shared_across_all_api_keys")}
        </p>
      ) : null}
      {warnings.length ? (
        <p role="status" className="m-0 text-sm font-semibold">
          {tStatic("staff.usage_alert")} {warnings.join("; ")}.
        </p>
      ) : null}
    </section>
  )
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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  if (!page || (page.offset === 0 && !page.hasMore)) return null

  return (
    <nav
      aria-label={tStatic("staff.api_key_pages")}
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <span className="text-sm text-(--t-ink-dim)">
        {tStatic("staff.keys")} {page.offset + 1}–{page.offset + count}
      </span>
      <div className="flex gap-2">
        <Button
          variant="surface"
          size="pill"
          disabled={pending || page.offset === 0}
          onClick={() => onPage(Math.max(0, page.offset - 50))}
        >
          {tExisting("ui.previous")}
        </Button>
        <Button
          variant="surface"
          size="pill"
          disabled={pending || !page.hasMore}
          onClick={() => onPage(page.offset + 50)}
        >
          {tExisting("ui.next")}
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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
                ? tExisting("staticUi.mobile.expired")
                : tExisting("membershipPage.apiActive")

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
                        {tStatic("staff.regenerate")}
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
                        {tStatic("common.revoke")}
                      </Button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                  {count(key.requests)} requests ·{" "}
                  {formatApiBytes(key.bytes, locale)} this period ·{" "}
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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  if (!confirmation) return null

  return (
    <div
      className="mt-5 rounded-2xl border border-(--t-border-hi) bg-(--t-bg-surface) p-5"
      role="group"
      aria-label={tStatic("staff.confirm_key_change")}
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
          {tStatic("common.confirm")}
        </Button>
        <Button
          type="button"
          variant="surface"
          size="pill"
          disabled={pending}
          onClick={onCancel}
        >
          {tExisting("ui.cancel")}
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
  const tStatic = useTranslations("staticUi")

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
          {tStatic("staff.refresh_usage")}
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
  setupRequested: boolean
) {
  return {
    summary: hasApiUsage(data) && section === "overview",
    usage: hasApiUsage(data) && ["all", "usage"].includes(section),
    overage: data.active && ["all", "overview", "usage"].includes(section),
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
  const tStatic = useTranslations("staticUi")

  const [data, setData] = useState(initial)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState("")
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [keyCreationOpen, setKeyCreationOpen] = useState(false)
  const secretRef = useRef<HTMLDivElement>(null)
  const t = useTranslations("teamApiKeys")
  const tErrors = useTranslations("teamApiErrors")
  const [confirmation, setConfirmation] = useState<KeyChange | null>(null)
  const [pending, startTransition] = useTransition()
  const locale = useLocale()
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
          reauthUrl?: string
          secret?: string
          url?: string
        }
        if (!response.ok && redirectForReauthentication(result)) return
        if (!response.ok)
          throw new Error(
            result.error && tErrors.has(result.error as never)
              ? tErrors(result.error as never)
              : tErrors("unavailable")
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
  const visibility = apiDashboardVisibility(data, section, setupRequested)
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
      <ApiDashboardHeader
        data={data}
        subscription={subscription}
        pending={pending}
        onRefresh={handleRefresh}
      />
      {error ? (
        <Notice
          tone="warn"
          title={tStatic("staff.api_request_not_completed")}
          icon="mdi:alert-circle-outline"
        >
          <span role="alert">{error}</span>
        </Notice>
      ) : null}
      {!data.active ? subscription : null}
      {visibility.summary ? (
        <ApiUsageSummary data={data} locale={locale} />
      ) : null}
      {visibility.usage ? <ApiUsagePanel data={data} locale={locale} /> : null}
      {visibility.overage ? (
        section === "overview" ? (
          <details className="rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6">
            <summary className="cursor-pointer rounded font-semibold focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)">
              {tStatic("staff.spending_controls_and_next_invoice")}
            </summary>
            <div className="mt-5">
              <ApiOveragePanel
                data={data}
                locale={locale}
                pending={pending}
                request={request}
              />
            </div>
          </details>
        ) : (
          <ApiOveragePanel
            data={data}
            locale={locale}
            pending={pending}
            request={request}
          />
        )
      ) : null}
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
