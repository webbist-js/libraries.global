import { Badge } from "@/components/ds/Badge"
import { BarSeries } from "@/components/ds/BarSeries"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { TeamApiSubscribeDialog } from "@/components/staff/TeamApiSubscribeDialog"
import { Button } from "@/components/ui/button"
import { Link } from "@/lib/navigation"
import { API_ROADMAP } from "@/lib/team-api/roadmap"
import type { ApiDashboard } from "@/lib/team-api/types"

export const formatApiBytes = (n: number, locale: string) => {
  const gib = n >= 1024 ** 3

  return (
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: gib ? 0 : 1,
      maximumFractionDigits: gib ? 2 : 1,
    }).format(n / 1024 ** (gib ? 3 : 2)) + (gib ? " GiB" : " MiB")
  )
}
const money = (amount: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amount / 100
  )

function maySubscribe(data: ApiDashboard) {
  if (!data.organiser || !data.teamActive) return false
  if (!data.membership) return true

  return (
    !data.active &&
    !data.membership.revoked &&
    ["canceled", "incomplete_expired"].includes(data.membership.status)
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
}: {
  readonly data: ApiDashboard
  readonly locale: string
  readonly pending: boolean
  readonly error: string
  readonly clearError: () => void
  readonly request: (body: unknown) => void
  readonly confirming: boolean
}) {
  const count = (n: number) => new Intl.NumberFormat(locale).format(n)
  const canSubscribe = maySubscribe(data) && !data.pendingPayment && !confirming
  const status = data.active
    ? "API add-on active"
    : data.pendingPayment || confirming
      ? "Confirming payment"
      : !data.teamActive
        ? "Team inactive"
        : "API add-on not active"
  const summary = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 text-base text-(--t-ink-dim)">
      <Badge label={status} color={data.active ? "ok" : "warn"} dot />
      {data.membership ? (
        <span>
          {money(data.membership.unitAmount, data.membership.currency, locale)}{" "}
          / month
          {data.membership.paidThrough
            ? " · Paid through " +
              new Date(data.membership.paidThrough).toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
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
          Manage API billing
        </Button>
      ) : null}
    </div>
  )
  if (data.active && !data.membership?.cancelAtPeriodEnd)
    return (
      <section aria-label="Your API add-on">
        {summary}
        {!data.organiser ? (
          <p className="mt-2 mb-0 text-sm text-(--t-ink-dim)">
            Team Organisers manage the subscription and API keys. You can view
            usage.
          </p>
        ) : null}
      </section>
    )

  return (
    <StaffPanel
      title="Your API add-on"
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
              : "Connect your applications to published library records with the Team API add-on."}
        </p>
        {!data.teamActive ? (
          <p role="status">
            Your Team is inactive. Keys cannot make requests until the Team is
            renewed.{" "}
            <Link
              href="/staff/teams/billing"
              className="font-semibold text-(--t-accent-primary) underline underline-offset-4"
            >
              Open Team billing
            </Link>
          </p>
        ) : null}
        {data.membership?.revoked ? (
          <p role="status">Access is suspended following a payment reversal.</p>
        ) : null}
        {data.membership?.cancelAtPeriodEnd ? (
          <p role="status">
            Cancellation is scheduled. Manage API billing to change it.
          </p>
        ) : null}
        {!canSubscribe ? (
          <p>
            {count(data.limits.requests)} successful requests and{" "}
            {formatApiBytes(data.limits.bytes, locale)} of response data each
            calendar month; {count(data.limits.perMinute)} requests per minute,{" "}
            {data.limits.concurrency} at once across the Team. Create as many
            keys as you need; they all use this shared pool. There are no
            automatic overage charges.
          </p>
        ) : (
          <p className="m-0">
            {count(data.limits.requests)} successful requests and{" "}
            {formatApiBytes(data.limits.bytes, locale)} of response data each
            calendar month, shared across unlimited keys and everyone in your
            Team. Adding keys or seats does not increase this pool.
          </p>
        )}
      </div>
      {!data.organiser ? (
        <p className="mt-4 mb-0 text-base text-(--t-ink-dim)">
          Team Organisers manage the subscription and API keys. You can view
          usage.
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
                No usage recorded in this period.
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
  const reset = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(data.usage.resetsAt))
  const metrics = [
    {
      title: "Successful requests",
      used: data.usage.requests,
      limit: data.limits.requests,
      display: count,
    },
    {
      title: "Response data",
      used: data.usage.bytes,
      limit: data.limits.bytes,
      display: (n: number) => formatApiBytes(n, locale),
    },
  ]

  return (
    <StaffPanel
      title="This month"
      id="api-usage"
      aside={
        <p className="m-0 text-sm text-(--t-ink-dim)">
          Resets {reset}, 00:00 UTC
        </p>
      }
    >
      <p className="mt-0 mb-5 text-base leading-relaxed text-(--t-ink-dim)">
        One shared pool for {data.teamName}: every key and application uses the
        same monthly allowance. Adding keys or members does not increase or
        reset it.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
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
                of {metric.display(metric.limit)}
              </span>
            </p>
            <progress
              aria-label={metric.title}
              value={Math.min(Math.max(0, metric.used), metric.limit)}
              max={metric.limit}
              className="block h-2 w-full appearance-none overflow-hidden rounded-full bg-(--t-border-line) [&::-moz-progress-bar]:bg-(--t-accent-primary) [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-(--t-border-line) [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-(--t-accent-primary)"
            />
            <p className="mt-2 mb-0 text-sm text-(--t-ink-dim)">
              {metric.display(Math.max(0, metric.limit - metric.used))} left
              this month
            </p>
          </div>
        ))}
      </div>
      {data.warnings.length ? (
        <p
          role="status"
          className="mt-5 rounded-xl bg-(--t-bg-surface) p-4 text-base font-semibold"
        >
          Your Team has used at least 80% of its {data.warnings.join(" and ")}{" "}
          allowance.
        </p>
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
              : "No requests yet. Your Team’s usage will appear here."
          }
          dataTable={
            <UsageTable
              title="Daily API usage"
              firstColumn="Date (UTC)"
              rows={data.days.map((day) => ({ ...day, label: day.day }))}
              locale={locale}
            />
          }
        />
      </div>
      <p className="mt-5 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
        Response data is uncompressed JSON; media downloads aren’t counted.
        Totals include capacity reserved for requests still in progress. Failed
        responses don’t use your allowance.
      </p>
      <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
        {count(data.limits.perMinute)} requests per minute ·{" "}
        {data.limits.concurrency} at once across the Team · unlimited keys · no
        automatic overage charges.
      </p>
      {data.endpoints.length ? (
        <div className="mt-6">
          <h3 className="type-small-heading m-0">Usage by API</h3>
          <UsageTable
            title="Usage by API"
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
  const endpoints = [
    {
      method: "POST",
      path: "/api/v1/search/libraries",
      detail: "Search by text, place and filters",
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
            Using the API
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
                First-request guide
              </Link>
            </Button>
            <Button asChild variant="surface" size="pill">
              <Link href="/knowledge/data-api/team-api-reference">
                API reference
              </Link>
            </Button>
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-2xl bg-(--t-ink-base) text-(--t-ink-on-dark)">
            <pre
              translate="no"
              className="m-0 overflow-x-auto p-5 font-mono text-sm leading-[1.8]"
              tabIndex={0}
              aria-label="Example API request"
            >
              <code>{example}</code>
            </pre>
          </div>
          <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
            Search filters: country, region, libraryType, operationalStatus and
            near (latitude, longitude and radius in metres).
          </p>
          <div className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 sm:p-5">
            <h3 className="type-small-heading m-0 mb-3">
              When a request fails
            </h3>
            <dl className="m-0 divide-y divide-(--t-border-line) text-sm leading-relaxed">
              {[
                ["401", "The key is invalid or has expired."],
                [
                  "403",
                  "The key lacks that API, or the Team or add-on isn’t active.",
                ],
                ["429", "Rate limit or monthly allowance reached."],
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
              Cache hits count as requests.
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
            More ways to use library data
          </h3>
          <Badge label="Coming soon" color="dim" />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-(--t-ink-dim)">
          Proposed read-only APIs for public data. These endpoints are not
          available yet; paths and scope may change. They are not included in
          the current subscription.
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
