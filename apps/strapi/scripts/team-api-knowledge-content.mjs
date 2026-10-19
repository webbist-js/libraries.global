import { stripComponentIds } from "./team-pricing-content.mjs"

const text = (value) => ({ type: "text", text: value })
const p = (value) => ({ type: "paragraph", children: [text(value)] })
const h = (value) => ({ type: "heading", level: 2, children: [text(value)] })
const rich = (...body) => ({ __component: "content.rich-text", body })
const code = (language, value) => ({
  __component: "content.code-block",
  language,
  code: value,
  filename: null,
})
const link = (label, url) => ({ type: "link", url, children: [text(label)] })
const links = () => ({
  type: "paragraph",
  children: [
    link(
      "Signup, API keys and your first request",
      "/knowledge/data-api/team-api-quickstart"
    ),
    text(" · "),
    link(
      "Team API request reference",
      "/knowledge/data-api/team-api-reference"
    ),
    text(" · "),
    link(
      "Team API access and allowances",
      "/knowledge/data-api/team-api-access"
    ),
  ],
})

// Remove this temporary notice only after the deployed checkout passes owned
// sandbox acceptance. A source fix alone does not make production checkout work.
export const apiCheckoutNotice =
  "New Team API subscriptions are temporarily unavailable while we correct a checkout problem. If you are joining the beta or need API access, contact info@libraries.global. An existing active API subscription can continue to use its keys while its Team remains active. Live purchases are not enabled."

const notice = () =>
  rich(h("Current API availability"), p(apiCheckoutNotice), links())
const origin = "https://libraries.global"

export function apiOnboardingArticles(sectionId) {
  const article = (title, slug, summary, body) => ({
    title,
    slug,
    summary,
    author: "Libraries Global Editorial Team",
    articleStatus: "beta",
    section: { connect: [{ documentId: sectionId }] },
    body,
  })

  return [
    article(
      "Team API: signup, keys and your first request",
      "team-api-quickstart",
      "Set up your account and Team, subscribe when checkout is available, create an API key and make your first authenticated request. Includes the current closed-beta limitation.",
      [
        notice(),
        rich({
          type: "paragraph",
          children: [
            link("Request beta access", "/beta"),
            text(" · "),
            link("Create an account", "/auth/register"),
            text(" · "),
            link("Sign in", "/auth/signin"),
            text(" · "),
            link("Membership and Team enquiries", "/contribute/membership"),
            text(" · "),
            link("Your Team", "/staff/team"),
            text(" · "),
            link("API access", "/staff/team/api"),
          ],
        }),
        rich(
          h("1. Get beta access and create your account"),
          p(
            "Open https://libraries.global/beta and request access with your email address. Use the invitation link sent to you to open the site in that browser. Beta access and an account are separate: redeeming the invitation does not create an account or join a Team."
          ),
          p(
            "Open /auth/register. Enter your display name, email and password, then accept the account terms and age requirement. Follow the verification email before signing in at /auth/signin. You can also use the Google sign-in option. If your Team has invited you, use the same email address as that invitation. If you already have an account, sign in to it."
          ),
          p(
            "A beta invitation opens the website. A Team invitation joins your organisation. An API key authenticates your software. Keep these three steps separate."
          ),
          h("2. Arrange or join an active Team"),
          p(
            "If your library service already has a Team, ask its organiser to invite you and give you the organiser role if you will manage the API. Open the Team invitation, sign in with the invited address and accept it. An ordinary Team member can inspect API usage but cannot subscribe or create, regenerate or revoke keys."
          ),
          p(
            "To arrange a new Team, open Membership at /contribute/membership and choose the Team enquiry, or email info@libraries.global with your library service, organiser email and required seats. Team is an annual quotation and invoice offer. After confirming the agreement and payment, an administrator creates or renews the Team and sets its organiser, seats and covered Libraries. Registering an account or buying personal Pro does not create a Team."
          ),
          p(
            "For new quotes, Team costs £600/year excluding VAT for five seats, plus £120/year per additional seat. Eligible public-library services receive 20% off Team items (£480 and £96 respectively). Existing contracts keep their agreed terms. Ask us to arrange an owned beta test Team for a trial; do not assume the sandbox API checkout provisions a Team."
          ),
          h("3. Open the Team API dashboard"),
          p(
            "Open /staff/team, select the correct Team, then choose API access and usage. You can also open /staff/team/api and select the Team there. If you belong to several Teams, check the selector before creating a key or changing billing. The address may include ?team= followed by your Team's document identifier."
          ),
          p(
            "If you see a page-not-found response, check that your invitation was accepted and that you signed in with the invited email. If you see usage without purchase or key controls, ask an organiser to change your Team role. Staff access to a Library alone does not make you a Team Organiser."
          ),
          h("4. Subscribe when checkout is available"),
          p(
            "The API is a separate £15/month add-on for an active Team, including tax at the base GBP price. Stripe confirms the actual checkout amount. The public-library Team discount does not apply to this add-on. Review the displayed limits, membership terms and cancellation/refund policy, tick the agreement checkbox and choose Subscribe to API access."
          ),
          p(
            "During the closed beta, checkout uses Stripe Test mode and makes no real charge. Use only Stripe's documented test payment details in that test checkout: https://docs.stripe.com/testing. New subscriptions are currently blocked as stated above; contact us rather than repeatedly trying to pay."
          ),
          p(
            "After an accepted checkout, return to API access. Payment confirmation is pending means the payment has not yet been verified. The page checks again every ten seconds; Refresh usage also reloads it. Wait for API access is active before creating a key. A checkout success page alone does not activate the API. If confirmation persists, contact support with your Team name and approximate checkout time; do not send payment details or a key."
          ),
          h("5. Create and save an API key"),
          p(
            "In API keys, enter a name such as Council website. Choose Library search (search:read), Library records (libraries:read), or both. Search scope permits the POST search endpoint; records scope permits list and individual-record GET requests. Choose an optional future expiry date, within the next year, and select Create key."
          ),
          p(
            "Copy the full lg_api_ key from the one-time display into your application's server environment or secret store. Select I have saved it after saving it. The dashboard retains only a prefix and cannot show the full key again. If you lose it, regenerate the key. Give each application its own named key; all keys still share the Team allowance."
          ),
          p(
            "Never embed the key in browser JavaScript, public repositories, URLs or support messages. Requests authenticate with the key itself; they do not need your account password or browser beta cookie."
          ),
          h("6. Make your first request"),
          p(
            "In Bash, read the key without echoing it, then request one published Library. curl --fail-with-body reports HTTP errors while keeping the JSON error body. The response should be HTTP 200 with data and meta. A new key needs the Library records permission for this example."
          )
        ),
        code(
          "bash",
          String.raw`read -r -s -p 'Libraries Global API key: ' LIBRARIES_API_KEY
export LIBRARIES_API_KEY
printf '\n'
curl --fail-with-body --include '${origin}/api/v1/libraries?locale=en&limit=1' \
  -H "Authorization: Bearer $LIBRARIES_API_KEY"`
        ),
        rich(
          p(
            "For a first search, use a key with Library search enabled. Search returns a data array; a zero-length array is a successful search with no matches."
          )
        ),
        code(
          "bash",
          String.raw`curl --fail-with-body '${origin}/api/v1/search/libraries' \
  -H "Authorization: Bearer $LIBRARIES_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"q":"Bristol","locale":"en","limit":2}'`
        ),
        rich(
          h("7. Check usage and manage the key"),
          p(
            "Choose Refresh usage. This month shows successful requests and uncompressed response bytes, with daily history, per-key and per-endpoint totals, errors, last use and expiry. Your successful first requests count against the shared allowance. Failed requests do not consume the monthly allowance, but authenticated attempts affect the request rate. The default monthly limits are 100,000 successful requests and 10 GiB of JSON response data."
          ),
          p(
            "Regenerate asks for confirmation and immediately invalidates the old secret. Save the replacement and update every application using the old key. For a planned change without that immediate interruption, create a second named key if capacity permits, switch your application and revoke the first. Revoke permanently disables that key. Neither action resets usage."
          ),
          h("8. Renew, cancel or ask for help"),
          p(
            "Organisers open Manage API billing to update payment details or cancel renewal. Verified paid access continues to its paid-through date while the Team stays active. If the Team lapses, API requests stop even if the separate API subscription is still renewing; cancel API renewal separately when you no longer need it. Billing and key revocation remain available to organisers after a Team lapses."
          ),
          p(
            "For help, email info@libraries.global with your Team name, endpoint path, HTTP status, error.code and X-Request-Id when available. Omit the Authorization header, full key and personal payment data."
          ),
          links()
        ),
      ]
    ),
    article(
      "Team API request reference",
      "team-api-reference",
      "Authentication, scopes, search filters, Library records, cursor pagination, response fields, quotas and error codes for the versioned Team API.",
      [
        rich(
          h("Base URL, authentication and scope"),
          p(
            "Use https://libraries.global over HTTPS. Send Authorization: Bearer YOUR_API_KEY on every request. Keys belong to an active Team with verified paid API coverage. Library search requires search:read. List and individual Library records require libraries:read. The API exposes published public Library information; it provides no account, moderation, staff, billing, protected analytics or write operations. Browser sign-in and beta cookies are unnecessary for these machine routes."
          ),
          p(
            "These three versioned routes are available. There are no versioned place, event, bulk-download or key-management endpoints for API clients. The web application's internal APIs, the CMS and the search engine are not part of this contract."
          ),
          h("POST /api/v1/search/libraries"),
          p(
            "Send Content-Type: application/json and a JSON object. q is optional (default empty; at most 512 characters). locale defaults to en; en is currently the only live content locale. limit is an integer from 1 to 100 (default 20). offset is an integer from 0 to 10,000 (default 0). The request body is capped at 8 KiB. Unknown properties are rejected."
          ),
          p(
            "Optional filters are country (country slug), region (region slug), libraryType (the indexed Library type value), operationalStatus (the indexed operational value), and near with lat (-90 to 90), lng (-180 to 180) and radius (1 to 100,000 metres). Filters combine with AND. Use slugs such as united-kingdom and england, not display names. Read available type and operational values from records; operational examples include open and appointment_only. Raw filter expressions, sorting, multi-search and index settings are unavailable."
          )
        ),
        code(
          "json",
          JSON.stringify(
            {
              q: "Bristol",
              locale: "en",
              limit: 10,
              offset: 0,
              country: "united-kingdom",
              near: { lat: 51.4545, lng: -2.5879, radius: 25000 },
            },
            null,
            2
          )
        ),
        rich(
          p(
            "The response has data (an array) and meta with locale, limit, offset, estimatedTotal and attribution. estimatedTotal may be null and is an estimate, not a guaranteed complete count. Increase offset by limit to page through search; stop on an empty/short page or use the record list for longer sequential extraction. Search returns up to the requested number of hits and projects only documentId, name, slug, entityRef, shortName, summary, libraryType, operationalStatus, city, continent_slug, country_slug, country_name, region_slug, region_name and _geo when present. Retrieve the full record for its source credits."
          ),
          h("GET /api/v1/libraries"),
          p(
            "Query parameters: locale (default en), limit (integer 1–100, default 50), country (optional country slug), after (optional cursor from meta.nextCursor). Unknown or repeated parameters are rejected. The response has a data array and meta.locale, meta.nextCursor and meta.attribution. Pass each nextCursor back as after until it is null. Keep the same locale and country filter while paging. Treat the cursor as opaque; do not construct one from a name, offset or entityRef."
          ),
          p(
            "Pages are ordered by record document identifier. The list is not a frozen snapshot: published records can change while you page. Store the entityRef and updatedAt values returned, and allow nullable fields and new response fields. Missing information is not proof that a service is unavailable."
          )
        ),
        code(
          "javascript",
          `// Run on your server with LIBRARIES_API_KEY set in its environment.
const headers = { Authorization: 'Bearer ' + process.env.LIBRARIES_API_KEY };
let after = null;
do {
  const url = new URL('${origin}/api/v1/libraries');
  url.searchParams.set('locale', 'en');
  url.searchParams.set('limit', '10');
  url.searchParams.set('country', 'united-kingdom');
  if (after) url.searchParams.set('after', after);
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error('API HTTP ' + response.status);
  const page = await response.json();
  for (const library of page.data) console.log(library.entityRef, library.name);
  after = page.meta.nextCursor;
  if (after) await new Promise(resolve => setTimeout(resolve, 1100));
} while (after);`
        ),
        rich(
          h("GET /api/v1/libraries/{entityRef}"),
          p(
            "Take entityRef from a search or list result and URL-encode it as one path segment. Do not use documentId, a page URL or the Library's short slug. For example, europe:united-kingdom:scotland:national-library-of-scotland becomes europe%3Aunited-kingdom%3Ascotland%3Anational-library-of-scotland. Add ?locale=en. The response data is one object, rather than an array; an unknown reference returns 404. References reflect the geographic path and can change if a record moves or is renamed, so refresh a reference that stops resolving."
          )
        ),
        code(
          "javascript",
          `const entityRef = 'europe:united-kingdom:scotland:national-library-of-scotland';
const response = await fetch(
  '${origin}/api/v1/libraries/' + encodeURIComponent(entityRef) + '?locale=en',
  { headers: { Authorization: 'Bearer ' + process.env.LIBRARIES_API_KEY } }
);
if (!response.ok) throw new Error('API HTTP ' + response.status);
const { data: library } = await response.json();
console.log(library.name, library.sourceRecords);`
        ),
        rich(
          h("Record fields and attribution"),
          p(
            "List and detail records include documentId, name, slug, entityRef, shortName, summary, operationalStatus, operatorType, streetAddress, city, postalCode, location, timezone, website, phone, email, catalogueUrl, updatedAt, libraryType, country, region and sourceRecords. Country contains name, slug and iso2; region contains name and slug. Nullable values are returned as null. These routes do not populate every field visible elsewhere on the website."
          ),
          p(
            "Each sourceRecords entry can include dataset, recordId, retrievedAt, url, label, role, fields and datasetCredit. A datasetCredit contains key, publisher, licence, licenceUrl, attribution, redistribution and licenceStatus where known. Preserve meta.attribution and the relevant source credits. API access does not replace source-specific licences or redistribution restrictions. A missing dataset credit or unknown licence does not grant permission to redistribute."
          ),
          h("Shared limits and response headers"),
          p(
            "Default limits: 100,000 successful requests and 10 GiB of response data per calendar month, 60 authenticated attempts per minute, five concurrent requests, five active keys, 256 KiB per response and at most 100 records per page. Your dashboard shows the limits saved for your subscription. Every key shares the Team limits; creating or regenerating a key does not reset them. There are no automatic overage charges."
          ),
          p(
            "The month resets at 00:00 UTC on its first day, independently of the payment anniversary. Successful responses, including repeated requests and cache hits, consume allowance. Bytes measure UTF-8 JSON before compression; separate media downloads are excluded. In-flight reservations can temporarily raise dashboard counters. Failures release their monthly reservation, but authenticated attempts still affect rate limits."
          ),
          p(
            "Successful responses include X-Request-Id, X-API-Requests-Remaining and X-API-Quota-Reset (UTC ISO timestamp). Responses use Cache-Control: private, no-store and Vary: Authorization. Keep your key on the server. Detailed usage records are retained for 90 days; usage records do not retain raw keys, request bodies, query text or IP addresses."
          ),
          h("Errors and retries"),
          p(
            'Errors have the shape {"error":{"code":"invalid_api_key"}}. Inspect HTTP status and error.code before retrying. Some infrastructure or beta-gate failures can return a non-JSON response, so handle a failed JSON parse.'
          ),
          p(
            "400: invalid_search, invalid_query, invalid_limit, invalid_cursor, invalid_country or locale_unavailable. Correct the body/query and use locale=en. An oversized search body can return 413. Unsupported methods return 405."
          ),
          p(
            "401 invalid_api_key: the key is missing, malformed, expired, revoked or has been replaced. Check the Authorization header and ask the organiser to create or regenerate a key. Do not keep retrying the same credential."
          ),
          p(
            "403 api_scope_refused: enable the required scope by creating a suitable key. 403 team_inactive or api_addon_inactive: ask the organiser to renew the Team or resolve the separate API subscription. Payment and Team verification do not grant Library staff authority."
          ),
          p(
            "404 record_not_found: get the current entityRef from search or list and encode it correctly. Use the versioned route exactly as documented. Do not substitute a Strapi document identifier."
          ),
          p(
            "429 api_rate_limit or api_concurrency_limit: reduce request frequency or parallelism. api_request_allowance_exhausted or api_byte_allowance_exhausted: wait for the monthly reset. Honour Retry-After (seconds); quota responses also include X-API-Quota-Reset. Retry with backoff and jitter, and cap retries."
          ),
          p(
            "502 api_response_too_large: reduce limit and retry a smaller page. A single oversized record needs support. 502 api_upstream_unavailable or a 503 service/accounting error: retry with bounded backoff. These errors do not consume the monthly allowance. Do not log Authorization while collecting diagnostic details."
          ),
          links()
        ),
      ]
    ),
  ]
}

/** Preserve existing editorial blocks; replace only this rollout's notice. */
export function updateApiGuide(doc) {
  const body = stripComponentIds(doc.body ?? [])
  if (doc.slug === "the-public-api") {
    return [
      rich(
        h("API access in the closed beta"),
        p(
          "The versioned Team API provides published Library search, a paginated Library list and individual Library records. It is a separate £15/month add-on for an active Team. Organisers manage billing and named keys; members can inspect usage. Personal Pro and Library staff access do not include an API key."
        ),
        p(apiCheckoutNotice),
        h("What you can request"),
        p(
          "POST /api/v1/search/libraries searches published Libraries. GET /api/v1/libraries lists records with cursor pagination. GET /api/v1/libraries/{entityRef} retrieves a published record by its encoded geographic reference. English is the live content locale. There are no versioned place or event endpoints, free self-service API keys or nightly bulk downloads in this release."
        ),
        h("Licence and source credits"),
        p(
          "Keep the attribution and sourceRecords.datasetCredit returned with each record. Imported data can carry different source licences and redistribution restrictions; a paid API subscription does not replace them. Public Library pages remain free to read."
        ),
        links()
      ),
      ...body.slice(1),
    ]
  }
  if (
    ![
      "team-api-access",
      "teams-for-library-services",
      "plans-and-pro",
    ].includes(doc.slug)
  )
    return null
  const clean = body.filter(
    (block) =>
      !(
        block.__component === "content.rich-text" &&
        block.body?.[0]?.children?.[0]?.text === "Current API availability"
      )
  )
  if (doc.slug === "team-api-access") {
    const replace = (value) => {
      if (Array.isArray(value)) return value.map(replace)
      if (!value || typeof value !== "object") return value

      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          key === "text" &&
          typeof child === "string" &&
          child.startsWith(
            "The Team API add-on is available to invited testers"
          )
            ? "The Team API add-on runs in Stripe Test mode during the closed beta. Its catalogue price is £15/month for an active Team, with 100,000 successful requests and 10 GiB of uncompressed JSON per calendar month and up to five active keys. Beta test payments make no real charge. See Current API availability above before starting a subscription."
            : replace(child),
        ])
      )
    }

    return [notice(), ...replace(clean)]
  }

  return [...clean, notice()]
}
