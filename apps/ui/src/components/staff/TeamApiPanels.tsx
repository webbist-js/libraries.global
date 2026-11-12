import { useTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"
import { BarSeries } from "@/components/ds/BarSeries"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { TeamApiSubscribeDialog } from "@/components/staff/TeamApiSubscribeDialog"
import { Button } from "@/components/ui/button"
import { Link } from "@/lib/navigation"
import { API_ROADMAP, API_STAGED_RESOURCES } from "@/lib/team-api/roadmap"
import type { ApiDashboard, ApiWarning } from "@/lib/team-api/types"

import { formatApiBytes, formatPence, formatPeriodTime } from "./api-format"

export { formatApiBytes, formatPence, formatPeriodTime } from "./api-format"
const money = (amount: number, currency: string, locale: string) =>
  formatPence(amount, locale, currency)

function maySubscribe(data: ApiDashboard) {
  if (!data.organiser || !data.teamActive) return false
  if (!data.membership) return true

  return (
    !data.active &&
    !data.membership.revoked &&
    ["canceled", "incomplete_expired"].includes(data.membership.status)
  )
}

const DIMENSION_LABEL: Record<ApiWarning["dimension"], string> = {
  requests: "successful requests",
  bytes: "response data",
  credits: "analysis credits",
  cap: "overage cap",
}

/** The highest threshold reached per allowance, for a compact status list. */
export function warningSummary(warnings: readonly ApiWarning[]) {
  const top = new Map<ApiWarning["dimension"], number>()
  for (const w of warnings)
    top.set(w.dimension, Math.max(top.get(w.dimension) ?? 0, w.threshold))

  return [...top].map(([dimension, threshold]) =>
    dimension === "cap"
      ? `${threshold}% of your overage cap`
      : `${threshold}% of included ${DIMENSION_LABEL[dimension]}`
  )
}

export function ApiSubscriptionPanel({
  data,
  locale,
  pending,
  error,
  clearError,
  request,
  confirming,
  setupRequested = false,
}: {
  readonly setupRequested?: boolean
  readonly data: ApiDashboard
  readonly locale: string
  readonly pending: boolean
  readonly error: string
  readonly clearError: () => void
  readonly request: (body: unknown) => void
  readonly confirming: boolean
}) {
  const tStatic = useTranslations("staticUi")

  const count = (n: number) => new Intl.NumberFormat(locale).format(n)
  const canSubscribe = maySubscribe(data) && !data.pendingPayment && !confirming
  const status = data.active
    ? "API access active"
    : data.pendingPayment || confirming
      ? "Confirming payment"
      : !data.teamActive
        ? "Organisation inactive"
        : "API access not active"
  const summary = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 text-base text-(--t-ink-dim)">
      <Badge label={status} color={data.active ? "ok" : "warn"} dot />
      {data.membership ? (
        <span>
          {money(data.membership.unitAmount, data.membership.currency, locale)}{" "}
          / month, tax included
          {data.membership.paidThrough
            ? " · Paid through " +
              formatPeriodTime(data.membership.paidThrough, locale)
            : ""}
        </span>
      ) : null}
      {data.organiser && data.membership ? (
        <Button
          type="button"
          variant="link"
          className="h-auto min-h-11 p-0 text-base text-(--t-accent-primary) underline underline-offset-4"
          disabled={pending}
          onClick={() => request({ action: "portal", locale })}
        >
          {tStatic("staff.manage_api_billing")}
        </Button>
      ) : null}
    </div>
  )
  if (data.active && !data.membership?.cancelAtPeriodEnd)
    return (
      <section aria-label={tStatic("staff.your_api_subscription")}>
        {summary}
        {!data.organiser ? (
          <p className="mt-2 mb-0 text-sm text-(--t-ink-dim)">
            {tStatic(
              "staff.organisers_manage_the_subscription_overage_and_api_keys_you_can_view_usage"
            )}
          </p>
        ) : null}
      </section>
    )

  return (
    <StaffPanel
      title={tStatic("staff.your_api_subscription")}
      id="api-subscription"
      aside={
        canSubscribe ? (
          <div className="flex flex-wrap items-center gap-3">
            {data.price ? (
              <span className="text-base font-semibold text-(--t-ink-base)">
                {money(data.price.unitAmount, data.price.currency, locale)} /
                month
              </span>
            ) : null}
            <TeamApiSubscribeDialog
              key={data.teamId}
              initialOpen={setupRequested}
              data={data}
              locale={locale}
              pending={pending}
              error={error}
              clearError={clearError}
              request={request}
            />
          </div>
        ) : null
      }
    >
      {summary}
      <div className="mt-4 space-y-3 text-base leading-relaxed text-(--t-ink-dim)">
        <p className="m-0">
          {data.pendingPayment || confirming
            ? "Payment confirmation is pending. Access starts after your payment is verified."
            : data.active
              ? "API access stays active until the end of your paid period."
              : "Connect your applications to published library records with API access."}
        </p>
        {!data.teamActive ? (
          <p role="status">
            {tStatic(
              "staff.your_organisation_is_inactive_keys_cannot_make_requests_until_it_is_restored_contact_us_for_help"
            )}
          </p>
        ) : null}
        {data.membership?.revoked ? (
          <p role="status">
            {tStatic("staff.access_is_suspended_following_a_payment_reversal")}
          </p>
        ) : null}
        {data.membership?.cancelAtPeriodEnd ? (
          <p role="status">
            {tStatic(
              "staff.cancellation_is_scheduled_manage_api_billing_to_change_it"
            )}
          </p>
        ) : null}
        <p className="m-0">
          Each paid monthly period includes {count(data.limits.requests)}{" "}
          successful requests, {formatApiBytes(data.limits.bytes, locale)} of
          response data and {count(data.limits.analysisCredits)} analysis
          credits, shared by every key. {count(data.limits.perMinute)} requests
          a minute, {data.limits.concurrency} at once. Overage is off unless an
          organiser turns it on with a spending cap.
        </p>
      </div>
      {!data.organiser ? (
        <p className="mt-4 mb-0 text-base text-(--t-ink-dim)">
          {tStatic(
            "staff.organisers_manage_the_subscription_and_api_keys_you_can_view_usage"
          )}
        </p>
      ) : null}
    </StaffPanel>
  )
}

function UsageTable({
  title,
  firstColumn,
  rows,
  locale,
}: {
  readonly title: string
  readonly firstColumn: string
  readonly rows: {
    label: string
    requests: number
    bytes: number
    errors: number
  }[]
  readonly locale: string
}) {
  const tStatic = useTranslations("staticUi")

  const count = (n: number) => new Intl.NumberFormat(locale).format(n)

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={title}
      className="mt-3 max-h-[min(26rem,60dvh)] overflow-auto overscroll-contain rounded-2xl border border-(--t-border-line) outline-none focus-visible:ring-2 focus-visible:ring-(--t-accent-primary)"
    >
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="sr-only">{title}</caption>
        <thead className="sticky top-0 z-10 bg-(--t-bg-surface) text-(--t-ink-dim)">
          <tr>
            {[firstColumn, "Requests", "Response data", "Errors"].map(
              (label, i) => (
                <th
                  key={label}
                  scope="col"
                  className={
                    "px-4 py-3 font-semibold whitespace-nowrap " +
                    (i ? "text-right" : "")
                  }
                >
                  {label}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-6 text-center text-(--t-ink-dim)"
              >
                {tStatic("staff.no_usage_recorded_in_this_period")}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-(--t-border-line)">
              <th scope="row" className="px-4 py-3 font-normal break-words">
                {row.label}
              </th>
              <td className="px-4 py-3 text-right">{count(row.requests)}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {formatApiBytes(row.bytes, locale)}
              </td>
              <td className="px-4 py-3 text-right">{count(row.errors)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ApiUsagePanel({
  data,
  locale,
}: {
  readonly data: ApiDashboard
  readonly locale: string
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const count = (n: number) => new Intl.NumberFormat(locale).format(n)
  const firstDay = data.days[0]?.day
  const historyTitle =
    data.days.length >= 30
      ? "Requests per day · last 30 days"
      : firstDay
        ? "Requests per day · since " +
          new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(firstDay))
        : "Requests per day"
  const metrics = [
    {
      title: tExisting("teamApiSubscription.requests"),
      used: data.usage.requests,
      limit: data.limits.requests,
      display: count,
    },
    {
      title: tExisting("teamApiSubscription.responseData"),
      used: data.usage.bytes,
      limit: data.limits.bytes,
      display: (n: number) => formatApiBytes(n, locale),
    },
    {
      title: tExisting("teamApiSubscription.credits"),
      used: data.usage.credits,
      limit: data.limits.analysisCredits,
      display: count,
    },
  ]
  const warnings = warningSummary(data.warnings)

  return (
    <StaffPanel
      title={tStatic("staff.this_billing_period")}
      id="api-usage"
      aside={
        <p className="m-0 text-sm text-(--t-ink-dim)">
          {data.usage.resetsAt
            ? "Resets " + formatPeriodTime(data.usage.resetsAt, locale)
            : "No paid period is active"}
        </p>
      }
    >
      <p className="mt-0 mb-5 text-base leading-relaxed text-(--t-ink-dim)">
        One shared pool for {data.teamName}: every key and application uses the
        same allowance. A new allowance starts only when the next monthly
        payment is confirmed; adding keys or members never increases or resets
        it.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.title}
            className="min-w-0 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-surface) p-4 sm:p-5"
          >
            <h3 className="type-small-heading m-0 text-(--t-ink-dim)">
              {metric.title}
            </h3>
            <p className="mt-2 mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums">
              <span className="type-stat">{metric.display(metric.used)}</span>
              <span className="text-sm text-(--t-ink-dim)">
                {tExisting("widgetPublic.of")} {metric.display(metric.limit)}{" "}
                included
              </span>
            </p>
            <progress
              aria-label={metric.title}
              value={Math.min(Math.max(0, metric.used), metric.limit)}
              max={metric.limit}
              className="block h-2 w-full appearance-none overflow-hidden rounded-full bg-(--t-border-line) [&::-moz-progress-bar]:bg-(--t-action-primary) [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-(--t-border-line) [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-(--t-action-primary)"
            />
            <p className="mt-2 mb-0 text-sm text-(--t-ink-dim)">
              {metric.used > metric.limit
                ? metric.display(metric.used - metric.limit) +
                  " over, billed as overage"
                : metric.display(metric.limit - metric.used) +
                  " left this period"}
            </p>
          </div>
        ))}
      </div>
      {warnings.length ? (
        <div
          role="status"
          className="mt-5 rounded-xl bg-(--t-bg-surface) p-4 text-base"
        >
          <p className="m-0 font-semibold">
            {tStatic("staff.usage_alerts_this_period")}
          </p>
          <ul className="mt-2 mb-0 list-disc pl-5">
            {warnings.map((text) => (
              <li key={text}>You have used {text}.</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-5">
        <BarSeries
          compact
          title={historyTitle}
          heading="h3"
          points={data.days.map((day) => ({
            date: day.day,
            value: day.requests,
          }))}
          highlightLast
          valueLabel="Requests"
          locale={locale}
          emptyMessage={
            data.organiser && data.active
              ? "No requests yet. Create a key below and make your first call."
              : "No requests yet. Your organisation’s usage will appear here."
          }
          dataTable={
            <UsageTable
              title={tStatic("staff.daily_api_usage")}
              firstColumn="Date (UTC)"
              rows={data.days.map((day) => ({ ...day, label: day.day }))}
              locale={locale}
            />
          }
        />
      </div>
      <p className="mt-5 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
        {tStatic(
          "staff.response_data_is_uncompressed_json_media_downloads_aren_t_counted_totals_include_capacity_reserved_f"
        )}
      </p>
      <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
        {count(data.limits.perMinute)} requests per minute ·{" "}
        {data.limits.concurrency} at once · {count(data.limits.pageSize)}{" "}
        records per page · {formatApiBytes(data.limits.responseBytes, locale)}{" "}
        largest response · unlimited keys.
      </p>
      {data.endpoints.length ? (
        <div className="mt-6">
          <h3 className="type-small-heading m-0">
            {tStatic("staff.usage_by_api")}
          </h3>
          <UsageTable
            title={tStatic("staff.usage_by_api")}
            firstColumn="API"
            rows={data.endpoints.map((row) => ({
              ...row,
              label: row.endpoint,
            }))}
            locale={locale}
          />
        </div>
      ) : null}
    </StaffPanel>
  )
}

export function ApiGuidePanel() {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const endpoints = [
    {
      method: "POST",
      path: "/api/v1/search/libraries",
      detail: tExisting("developersOffer.discover"),
    },
    {
      method: "GET",
      path: "/api/v1/libraries?locale=en&limit=50",
      detail: "List libraries, 50 at a time",
    },
    {
      method: "GET",
      path: "/api/v1/libraries/{entityRef}?locale=en",
      detail: "Read one library’s full record",
    },
    {
      method: "GET",
      path: "/api/v1/places/{country}/{region}",
      detail: "Browse countries, then their regions and areas, with counts",
    },
    {
      method: "GET",
      path: "/api/v1/places/{country}/{region}/{area}/libraries",
      detail: "List the libraries in a country, region or area",
    },
  ]
  const example = [
    "# Search libraries",
    "curl -X POST https://libraries.global/api/v1/search/libraries \\",
    "  -H 'Authorization: Bearer YOUR_API_KEY' \\",
    "  -H 'Content-Type: application/json' \\",
    '  -d \'{ "q": "Bristol", "locale": "en", "limit": 20 }\'',
  ].join("\n")

  return (
    <StaffPanel id="api-guide">
      <div className="grid min-w-0 gap-7 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 id="api-guide-title" className="type-h2 m-0">
            {tStatic("staff.using_the_api")}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-(--t-ink-dim)">
            Keep keys in your application server’s environment. Requests use{" "}
            <code
              translate="no"
              className="rounded bg-(--t-bg-muted) px-1 font-mono text-sm break-words text-(--t-ink-base)"
            >
              Authorization: Bearer YOUR_API_KEY
            </code>
            . Keys read published public data only; they never grant staff or
            account permissions.
          </p>
          <ul className="m-0 list-none divide-y divide-(--t-border-line) p-0">
            {endpoints.map((endpoint) => (
              <li
                key={endpoint.path}
                className="flex min-w-0 items-start gap-3 py-3"
              >
                <Badge
                  label={endpoint.method}
                  color={endpoint.method === "POST" ? "aurora" : "ok"}
                />
                <div className="min-w-0">
                  <code
                    translate="no"
                    className="block font-mono text-sm break-all"
                  >
                    {endpoint.path}
                  </code>
                  <p className="mt-1 mb-0 text-sm text-(--t-ink-dim)">
                    {endpoint.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <details className="mt-6 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4">
            <summary className="cursor-pointer rounded text-sm font-semibold focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)">
              {tStatic(
                "staff.services_analysis_and_proposals_staged_availability"
              )}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-(--t-ink-dim)">
              These routes are switched on in stages. While one is off it
              answers 404 <code translate="no">resource_not_enabled</code> and
              nothing is charged. Analysis and proposal scopes must be chosen
              when you create a key.
            </p>
            <ul className="m-0 list-none divide-y divide-(--t-border-line) p-0">
              {API_STAGED_RESOURCES.map((endpoint) => (
                <li
                  key={`${endpoint.method} ${endpoint.path}`}
                  className="flex min-w-0 items-start gap-3 py-3"
                >
                  <Badge
                    label={endpoint.method}
                    color={endpoint.method === "POST" ? "aurora" : "ok"}
                  />
                  <div className="min-w-0">
                    <code
                      translate="no"
                      className="block font-mono text-sm break-all"
                    >
                      {endpoint.path}
                    </code>
                    <p className="mt-1 mb-0 text-sm text-(--t-ink-dim)">
                      {endpoint.detail}{" "}
                      <code translate="no" className="text-xs">
                        {endpoint.scope}
                      </code>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </details>
          <p className="mt-3 text-sm leading-relaxed text-(--t-ink-dim)">
            Encode the <code translate="no">entityRef</code> from a search or
            list as one path segment with{" "}
            <code translate="no">encodeURIComponent</code> (it contains colons).
            Lists return <code translate="no">nextCursor</code>; pass it as{" "}
            <code translate="no">after</code>. Keep the source credits and
            licences returned with each record.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="primary" size="pill">
              <Link href="/knowledge/data-api/team-api-quickstart">
                {tExisting("developersWorkspace.quickstart")}
              </Link>
            </Button>
            <Button asChild variant="surface" size="pill">
              <Link href="/knowledge/data-api/team-api-reference">
                {tStatic("staff.api_reference")}
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="overflow-hidden rounded-2xl bg-(--t-bg-inverse) text-(--t-ink-on-dark)">
            <pre
              translate="no"
              className="m-0 overflow-x-auto p-5 font-mono text-sm leading-[1.8]"
              tabIndex={0}
              aria-label={tStatic("staff.example_api_request")}
            >
              <code>{example}</code>
            </pre>
          </div>
          <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
            {tStatic(
              "staff.search_filters_country_region_librarytype_operationalstatus_and_near_latitude_longitude_and_radius_i"
            )}
          </p>
          <div className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 sm:p-5">
            <h3 className="type-small-heading m-0 mb-3">
              {tStatic("staff.when_a_request_fails")}
            </h3>
            <dl className="m-0 divide-y divide-(--t-border-line) text-sm leading-relaxed">
              {[
                ["401", "The key is invalid or has expired."],
                [
                  "403",
                  "The key lacks that scope, or API access isn’t active.",
                ],
                [
                  "429",
                  "Rate, concurrency, allowance or overage cap reached; see error.code and Retry-After.",
                ],
              ].map(([code, text]) => (
                <div key={code} className="flex gap-4 py-2 first:pt-0">
                  <dt className="font-mono font-semibold text-(--t-accent-danger)">
                    {code}
                  </dt>
                  <dd className="m-0">{text}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 mb-0 text-sm text-(--t-ink-dim)">
              {tStatic("staff.cache_hits_count_as_requests")}
            </p>
          </div>
        </div>
      </div>
      <section
        aria-labelledby="api-coming-soon"
        className="mt-7 border-t border-(--t-border-line) pt-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h3 id="api-coming-soon" className="type-h3 m-0">
            {tStatic("staff.more_ways_to_use_library_data")}
          </h3>
          <Badge label={tExisting("ui.coming_soon")} color="dim" />
        </div>
        <p className="mt-3 mb-6 text-sm leading-relaxed text-(--t-ink-dim)">
          {tStatic(
            "staff.proposed_read_only_apis_for_public_data_these_endpoints_are_not_available_yet_paths_and_scope_may_ch"
          )}
        </p>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {API_ROADMAP.map((item) => (
            <li
              key={item.path}
              className="min-w-0 rounded-2xl border border-(--t-border-line) p-4"
            >
              <h4 className="type-h4 m-0">{item.title}</h4>
              <code
                translate="no"
                className="mt-2 block font-mono text-xs break-all text-(--t-accent-primary)"
              >
                GET {item.path}
              </code>
              <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </StaffPanel>
  )
}
