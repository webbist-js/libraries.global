import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { API_TERMS_VERSION } from "@/lib/team-api/constants"
import type { ApiDashboard } from "@/lib/team-api/types"

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold disabled:opacity-50"
const count = (n: number) => n.toLocaleString("en-GB")
const bytes = (n: number) =>
  n >= 1024 ** 3
    ? `${(n / 1024 ** 3).toFixed(2)} GiB`
    : `${(n / 1024 ** 2).toFixed(2)} MiB`
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
  consent,
  setConsent,
  request,
  confirming,
}: {
  readonly data: ApiDashboard
  readonly locale: string
  readonly pending: boolean
  readonly consent: boolean
  readonly setConsent: (value: boolean) => void
  readonly request: (body: unknown) => void
  readonly confirming: boolean
}) {
  return (
    <section
      className="rounded-2xl border p-6"
      aria-labelledby="api-subscription-title"
    >
      <h2
        id="api-subscription-title"
        className="mb-3 text-2xl"
        style={{ fontFamily: T.font.serif }}
      >
        Your API add-on
      </h2>
      <p>
        {data.active
          ? "API access is active."
          : data.pendingPayment || confirming
            ? "Payment confirmation is pending. Access starts after your payment is verified."
            : "API access is a paid add-on for active Teams."}
      </p>
      {!data.teamActive ? (
        <p className="mt-3" role="status">
          Your Team is inactive. Keys cannot make requests until the Team is
          renewed.
        </p>
      ) : null}
      <p className="mt-3">
        {count(data.limits.requests)} successful requests and{" "}
        {bytes(data.limits.bytes)} of response data each calendar month;{" "}
        {count(data.limits.perMinute)} requests per minute,{" "}
        {data.limits.concurrency} at once, and up to {data.limits.keys} keys.
        There are no automatic overage charges.
      </p>
      {data.membership ? (
        <p className="mt-3">
          {money(data.membership.unitAmount, data.membership.currency, locale)}{" "}
          per month.
          {data.membership.cancelAtPeriodEnd
            ? " Cancellation is scheduled."
            : ""}
          {data.membership.paidThrough
            ? ` Paid through ${new Date(data.membership.paidThrough).toLocaleDateString(locale)}.`
            : ""}
          {data.membership.revoked
            ? " Access is suspended following a payment reversal."
            : ""}
        </p>
      ) : null}
      {data.organiser && data.membership ? (
        <button
          type="button"
          className={`${BUTTON} mt-4`}
          disabled={pending}
          onClick={() => request({ action: "portal", locale })}
        >
          Manage API billing
        </button>
      ) : null}
      {maySubscribe(data) ? (
        <div className="mt-4 space-y-3">
          {data.price ? (
            <p>
              {money(data.price.unitAmount, data.price.currency, locale)} per
              month, including tax at the base GBP price. Stripe confirms your
              checkout amount.
            </p>
          ) : (
            <p>
              API purchasing is currently unavailable. Please try again later.
            </p>
          )}
          <label className="flex max-w-2xl items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 size-5"
            />
            <span>
              I agree to the{" "}
              <Link href="/legal/membership" className="underline">
                membership terms
              </Link>
              ,{" "}
              <Link href="/legal/cancellation-refunds" className="underline">
                cancellation and refund policy
              </Link>
              , and the API limits shown here, and request access as soon as
              payment is confirmed.
            </span>
          </label>
          <button
            type="button"
            className={BUTTON}
            disabled={pending || !consent || !data.purchasing}
            onClick={() =>
              request({
                action: "checkout",
                locale,
                termsVersion: API_TERMS_VERSION,
              })
            }
          >
            Subscribe to API access
          </button>
        </div>
      ) : null}
      {!data.organiser ? (
        <p className="mt-3">
          Team Organisers manage the subscription and API keys. You can view
          usage.
        </p>
      ) : null}
    </section>
  )
}
export function ApiUsagePanel({
  data,
  locale,
}: {
  readonly data: ApiDashboard
  readonly locale: string
}) {
  const maxRequests = Math.max(1, ...data.days.map((day) => day.requests))
  const reset = new Date(data.usage.resetsAt).toLocaleDateString(locale)

  return (
    <section
      className="rounded-2xl border p-6"
      aria-labelledby="api-usage-title"
    >
      <h2
        id="api-usage-title"
        className="mb-4 text-2xl"
        style={{ fontFamily: T.font.serif }}
      >
        This month
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {[
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
            display: bytes,
          },
        ].map((metric) => (
          <div key={metric.title}>
            <p className="mb-2 font-semibold">{metric.title}</p>
            <p>
              {metric.display(metric.used)} / {metric.display(metric.limit)}
            </p>
            <progress
              className="mt-3 h-3 w-full"
              aria-label={metric.title}
              value={metric.used}
              max={metric.limit}
            />
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm">
        Allowances reset on {reset} at 00:00 UTC. Response data measures
        uncompressed JSON; separate media downloads are excluded. Totals include
        reserved capacity for requests in progress.
      </p>
      {data.warnings.length ? (
        <p role="status" className="mt-4 font-semibold">
          Your Team has used at least 80% of its {data.warnings.join(" and ")}{" "}
          allowance.
        </p>
      ) : null}
      <h3 className="mt-6 mb-3 font-semibold">
        Requests over the last 30 days
      </h3>
      {data.days.length ? (
        <>
          <div className="flex h-32 items-end gap-1" aria-hidden="true">
            {data.days.map((day) => (
              <span
                key={day.day}
                className="min-w-1 flex-1 rounded-t"
                style={{
                  height: `${Math.max(2, (day.requests / maxRequests) * 100)}%`,
                  background: T.accent.primary,
                }}
                title={`${day.day}: ${count(day.requests)} requests`}
              />
            ))}
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer">Daily usage table</summary>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Date (UTC)</th>
                    <th>Requests</th>
                    <th>Response data</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((day) => (
                    <tr key={day.day}>
                      <th scope="row" className="py-2 font-normal">
                        {day.day}
                      </th>
                      <td>{count(day.requests)}</td>
                      <td>{bytes(day.bytes)}</td>
                      <td>{count(day.errors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p>No API usage yet.</p>
      )}
      {data.endpoints.length ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-3 text-left font-semibold">
              Usage by API
            </caption>
            <thead>
              <tr>
                <th>API</th>
                <th>Requests</th>
                <th>Response data</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {data.endpoints.map((row) => (
                <tr key={row.endpoint}>
                  <th scope="row" className="py-2 font-normal">
                    {row.endpoint}
                  </th>
                  <td>{count(row.requests)}</td>
                  <td>{bytes(row.bytes)}</td>
                  <td>{count(row.errors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
export function ApiGuidePanel() {
  return (
    <section
      className="rounded-2xl border p-6"
      aria-labelledby="api-guide-title"
    >
      <h2
        id="api-guide-title"
        className="mb-3 text-2xl"
        style={{ fontFamily: T.font.serif }}
      >
        Using the API
      </h2>
      <p>
        Keep keys in your application server&apos;s environment. Requests use{" "}
        <code>Authorization: Bearer YOUR_API_KEY</code>. Keys give access to
        published public data and do not grant staff or account permissions.
      </p>
      <p className="mt-3">
        <Link
          href="/knowledge/data-api/team-api-quickstart"
          className="underline"
        >
          Follow the signup and first-request guide
        </Link>
        {" or read the "}
        <Link
          href="/knowledge/data-api/team-api-reference"
          className="underline"
        >
          API reference
        </Link>
        .
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-white p-4 text-sm">{`POST /api/v1/search/libraries\n{ "q": "Bristol", "locale": "en", "limit": 20 }\n\nGET /api/v1/libraries?locale=en&limit=50\nGET /api/v1/libraries/{entityRef}?locale=en`}</pre>
      <p className="mt-3 text-sm">
        Use the entityRef returned by search or a list for a single library,
        encoded as one URL path segment (encodeURIComponent in JavaScript).
        References include colons, for example
        europe:united-kingdom:scotland:national-library-of-scotland. Lists
        return a nextCursor; pass it as after to fetch the next page. Search
        supports country, region, libraryType, operationalStatus and near (lat,
        lng, radius in metres). Keep the source credits and licences returned
        with each record.
      </p>
      <p className="mt-3 text-sm">
        A 401 means the key is invalid or expired; 403 means its scope, Team or
        add-on is inactive; 429 means a rate or allowance limit was reached.
        Cache hits count as requests. Failed responses do not use the monthly
        allowance.
      </p>
    </section>
  )
}
