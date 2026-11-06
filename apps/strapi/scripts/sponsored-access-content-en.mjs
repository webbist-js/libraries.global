/**
 * English Knowledge copy for the free-participation, verified-staff, paid-API
 * and sponsorship model. Figures come from `v` (see `accessValues` in
 * `sponsored-access-content.mjs`), so the copy follows the agreed catalogue.
 *
 * Markdown subset: `## ` and `### ` headings, blank-line paragraphs, `- ` and
 * `1. ` lists, `[label](/path)` links, `**bold**`, `inline code` and fenced
 * code blocks. The fr, cs and es modules mirror these keys exactly.
 */
export default (v) => ({
  articles: {
    "plans-and-pro": {
      title: "Plans and pricing",
      summary:
        "What is free, what you earn by contributing, what verified library staff receive, and what the paid API and sponsorship cover.",
      body: `Libraries Global is free public infrastructure. Reading library records, searching, using the Atlas and contributing cost nothing. Only two things are paid: machine access through the API, and sponsorship by organisations that want to fund the public service. Paying never buys trust, search ranking, editorial treatment or staff authority.

## Explorer: every free account

You can read library pages, search and use the map without an account. A free account makes you an Explorer and adds tools that were previously paid:

- comparison, saved views and saved searches (up to ${v.savedViews} of each)
- alerts, notes and detailed change history on library pages
- Atlas context layers, such as population density, Library access comparisons, deprivation and households without a car, where the data is available
- exports of up to ${v.exportRows} rows at a time, and up to ${v.exportsPerDay} exports in any rolling 24 hours

Explorer does not include Reach travel-time calculations. They are expensive to run, so contributors and API customers receive them in limited amounts.

## Contributor and Supporter: earned, never bought

Your first accepted contribution makes you a Contributor. Contributors can run ${v.contributorReach} new one-library Reach calculations in any rolling seven days. Reopening an identical saved result does not use the allowance. Service and network Reach are not included.

At ${v.supporterThreshold} accepted contributions you receive Supporter recognition. Supporter is a thank-you: it adds no tools, quota or authority. [Contributor and Supporter recognition](/knowledge/contributing/earned-recognition-and-rewards) explains what counts.

## Verified Staff: free for library staff

Staff whose relationship to a library has been verified look after its record for free: hours, services, accessibility, notices, event feeds and mobile stops. A free staff workspace lets colleagues work together, publish embeds and widgets, and see who else is involved. These tools apply only to the libraries in your own verified staff access. Joining an organisation's workspace does not, by itself, let you edit its libraries. Read [Verified staff and free workspaces](/knowledge/governance/teams-for-library-services).

## API Access: ${v.price} a month

The API is for software that reads library data, proposes changes or runs analysis on a schedule or at scale. It costs ${v.price} a month, including tax at the base GBP price; Stripe shows the final amount, including any local tax, before you pay. Each billing period includes ${v.requests} successful requests, ${v.mib} of response data and ${v.credits} analysis credits. Extra usage is refused unless you switch on capped overage.

An API account belongs to an organisation. If you buy as an individual, a single-member organisation is created for you at checkout. You do not need a staff workspace or any other purchase first. Start with [The Libraries Global API](/knowledge/data-api/the-public-api) and [API limits, overages and billing](/knowledge/data-api/team-api-access).

## Sponsorship

Organisations can fund the public service under an annual agreement. With the sponsor's consent we acknowledge them publicly and report on the work their funding supports. Sponsorship does not include API access and gives no influence over records, search ranking, verification or editorial decisions. Read [Sponsoring Libraries Global](/knowledge/governance/sponsoring-libraries-global).

## What payment never changes

Points, badges, recognition, roles, moderation and staff verification are never sold. A paid API key authenticates software; it does not identify a person or carry staff authority. Library facts stay free to read, and the data stays under its published licences.

## During the closed beta

While the closed beta continues, API checkout uses Stripe Test mode and no real payment is taken. Some API features are introduced in stages; the developer pages show what is enabled for your account. The earlier beta test plans for personal memberships, workspace seats and the previous API add-on have been withdrawn.`,
    },

    "earned-recognition-and-rewards": {
      title: "Contributor and Supporter recognition",
      summary:
        "How accepted contributions make you a Contributor and, at 100, a Supporter, what each status gives you and what it never gives you.",
      body: `Recognition says thank you for work that improves the shared record. It is earned through accepted contributions and cannot be bought.

## Contributor

Your first accepted contribution makes you a Contributor. Contributors can run ${v.contributorReach} new one-library Reach calculations in any rolling seven days in the Atlas. Opening an identical saved result is free and does not use the allowance. Service and network Reach are not included.

## Supporter

At ${v.supporterThreshold} accepted contributions you receive Supporter recognition. It stays with your account; it does not lapse if you take a break. Your profile separately shows whether you have contributed in the last ${v.activityDays} days. Supporter adds no tools, no extra quota and no authority. Where the site lists Supporters publicly, your profile privacy choices apply.

## What counts

We count accepted contributions, one for each accepted submission or suggestion, not your points total. Accepted new libraries, record edits and corrections, verified hours or status checks, photos with a suitable licence, sources, Knowledge and Journal writing, edits and translations, drive tasks and proposals, reviewed discussion threads, replies and edits, event-feed connections and accepted checklist-option suggestions all count.

These never count: administrative point adjustments, daily streaks, automatic bonuses such as drive-completion awards, votes, reactions, drafts and submissions still waiting for review. Each accepted contribution is counted once, even if it is reviewed again or delivered late.

## Points and badges

Points, tiers and badges continue for the leaderboard and your profile. Tiers still adjust contribution limits such as how many submissions can wait for review. Points and tiers never unlock paid tools, and a badge is not a recognition status.

## Revocation

Moderators can revoke recognition when contributions were fraudulent or duplicated, for example the same change submitted repeatedly to inflate a count. Revocation removes Contributor and Supporter status. It does not remove published public facts, and you can contact us if you think it was a mistake.

## What recognition never gives

Recognition never grants editing rights, staff verification, moderation, a community role or machine API access. Roles come from Role Grants and approved library claims. Read [How review works](/knowledge/governance/how-review-works) and [Points, streaks and tiers](/knowledge/contributing/points-streaks-and-tiers).`,
    },

    "teams-for-library-services": {
      title: "Verified staff and free workspaces",
      summary:
        "Free tools for verified library staff, how staff workspaces work, and why joining an organisation never grants editing authority on its own.",
      body: `Library staff and volunteers who look after a library's record use Libraries Global for free. Payment plays no part in staff access.

## Becoming verified staff

Claim your library from its page or from [Claim a library](/staff/claim). A moderator reviews the claim. Once approved, you have staff access to that library as an owner or editor. An organiser can also assign you to a library that their verified workspace covers. Either way, your access is recorded against named libraries.

## What verified staff can do

For the libraries in your staff access you can update hours, services and accessibility information, post notices, connect event feeds and manage mobile library routes and stops. Most edits publish directly; sensitive changes, such as moving a library or closing it permanently, still go to a moderator. You can also review other people's suggestions about your own library.

## Free staff workspaces

A staff workspace is an organisation's shared space: its name, its members, one or more organisers, and the libraries it covers. Any account with a verified email address can create one for free. Covering a library still requires verified owner authority over that library.

Workspaces let colleagues see who is involved, share embeds and widgets such as library finders and comparison charts, use bulk upload, and see traffic reports where they are available. All of these tools work only for the libraries in each person's own verified staff access.

## Organisers and members

Organisers manage the workspace: its name, members, invitations and covered libraries. Members can see the workspace and use the staff tools their own access allows. Being an organiser, or a member, does not by itself give editing authority over any library. Before the last organiser deletes their account, they must hand the role to another member.

## Workspaces and the API

The same organisation can also hold an API account, but the two are separate. A workspace does not include API access, and buying API access never verifies staff or grants editing rights. Read [Plans and pricing](/knowledge/governance/plans-and-pro) and [The Libraries Global API](/knowledge/data-api/the-public-api).

## No seat charges

Workspaces no longer have seat charges, seat limits or annual billing. Staff tools do not depend on any payment.`,
    },

    "the-public-api": {
      title: "The Libraries Global API",
      summary:
        "What the paid API provides, who it is for, how API accounts are organised, and which features are introduced in stages.",
      body: `The API gives software versioned access to published library information. Library pages, search and the Atlas remain free for people to use; the API is for applications that need the data on a schedule or at scale.

## What you can do

- search published libraries and list records with stable pagination
- read individual library records and browse libraries by place
- read published library services and networks and their member libraries
- send new-library proposals and corrections into the moderation queue
- run bounded analysis, including Reach for a library or a service

Each request uses a key with the matching scope. Some features are introduced in stages and may not be enabled yet; [the API reference](/developers/reference) and your dashboard show what your account can call.

## Price and allowances

API access costs ${v.price} a month, including tax at the base GBP price. Each billing period includes ${v.requests} successful requests, ${v.mib} of response data and ${v.credits} analysis credits, shared across all of your keys. When an allowance runs out, further requests are refused unless you have switched on capped overage. Read [API limits, overages and billing](/knowledge/data-api/team-api-access).

## API accounts and organisations

An API account belongs to an organisation. If you buy as an individual, a single-member organisation is created for you at checkout. Organisers manage billing, keys and overage settings; members can see usage. An organisation can have one active API subscription. You do not need a staff workspace, and a staff workspace does not include API access.

## What a key does not do

A key authenticates your software. It is not a user session and does not identify a person. It gives no staff authority, no access to accounts or private data, and no way to publish changes directly. Proposals sent through the API are reviewed like anyone else's.

## Licences and credit

Responses carry attribution and source records, including each dataset's licence and redistribution terms. Keep them with the data. A paid subscription does not replace a source's licence. Read the [data licence](/legal/data-licence).

## Get started

[Create your first key and make a request](/knowledge/data-api/team-api-quickstart), then read the [reference, scopes and troubleshooting](/knowledge/data-api/team-api-reference) guide. During the closed beta, checkout uses Stripe Test mode and no real payment is taken.`,
    },

    "team-api-quickstart": {
      title: "API: your first key and request",
      summary:
        "Buy API access, create a key with the right scopes and make your first authenticated request.",
      body: `This guide takes you from a free account to a working API request.

## 1. Create and verify your account

Create an account at [Register](/auth/register) and follow the verification email. During the closed beta you also need a beta invitation to open the site. A beta invitation, an account and an API key are three separate things.

## 2. Buy API access

Open [Developers](/developers) and choose to subscribe. If you already organise an organisation, you can buy for it; otherwise a single-member organisation is created for you. Review the price of ${v.price} a month, the included allowances and the [API purchase terms](/legal/membership), confirm your agreement and continue to Stripe Checkout.

Access starts only after the payment has settled. A checkout return page alone does not activate it. If confirmation takes a while, refresh the usage page rather than paying again. During the closed beta, use Stripe's test payment details only; no real payment is taken.

## 3. Create a key

Open [API keys](/developers/keys), name the key after the application that will use it, and choose its scopes. New keys get the read scopes by default: \`search:read\`, \`libraries:read\` and \`services:read\`. Analysis (\`analysis:run\`) and submissions (\`submissions:write\`) must be confirmed separately, because they spend credits or create proposals.

Copy the full key when it appears. It is shown once; we keep only a digest and a short prefix. Store it in your server's secret storage. Never put it in browser code, a public repository, a URL or a support message.

## 4. Make a request

This reads one published library record. It needs a key with \`libraries:read\`.

\`\`\`bash
read -r -s -p 'Libraries Global API key: ' LIBRARIES_API_KEY
export LIBRARIES_API_KEY
printf '\\n'
curl --fail-with-body --include 'https://libraries.global/api/v1/libraries?locale=en&limit=1' \\
  -H "Authorization: Bearer $LIBRARIES_API_KEY"
\`\`\`

A search needs \`search:read\`. An empty \`data\` array is a successful search with no matches.

\`\`\`bash
curl --fail-with-body 'https://libraries.global/api/v1/search/libraries' \\
  -H "Authorization: Bearer $LIBRARIES_API_KEY" \\
  -H 'Content-Type: application/json' \\
  --data '{"q":"Bristol","locale":"en","limit":2}'
\`\`\`

## 5. Check your usage

Open [Usage](/developers/usage). Your successful requests and response bytes count against the period's allowance. Failed requests do not use the allowance, but every attempt counts towards the rate limit.

## Next steps

Read [API limits, overages and billing](/knowledge/data-api/team-api-access), the [reference, scopes and troubleshooting](/knowledge/data-api/team-api-reference) guide and [Using the API playground](/knowledge/data-api/api-playground).`,
    },

    "team-api-access": {
      title: "API limits, overages and billing",
      summary:
        "Included allowances, rate limits, billing periods, opt-in capped overage and what is never charged.",
      body: `One API account has one shared allowance across all of its keys and applications. Adding or regenerating keys never adds to it or resets it.

## Included in each billing period

- ${v.requests} successful requests
- ${v.mib} (${v.bytes} bytes) of uncompressed JSON response data
- ${v.credits} analysis credits

The billing period is your subscription's paid period, from its start time up to, but not including, its end time, in UTC. It follows your payment date, not the calendar month. A first, partial period receives the full allowances. A new period's allowances start only when its payment has settled; a failed payment does not open free usage. Unused allowances do not roll over.

## Rate and size limits

Your account can make up to ${v.attemptsPerMinute} request attempts a minute and ${v.concurrent} requests at the same time. A response can be at most ${v.maxResponse}, and a page lists at most ${v.pageSize} records. Ask for a smaller page if a response would be too large.

## What counts

Every successful response counts as one request and its uncompressed JSON size counts towards response data, including repeated requests and cached answers. Analysis credits are spent only when a new job completes. Failed, refused and timed-out requests are not charged against your allowances, but every attempt counts towards the rate limit.

## When an allowance runs out

Without overage, the next request that would exceed an allowance is refused with HTTP 429 and a code naming the allowance. Your dashboard shows what remains and when the period resets. Warnings appear at 50%, 80% and 100% of each allowance.

## Capped overage

Overage is off until an organiser switches it on and accepts the overage terms. Beyond the included amounts it costs ${v.requestRate} per request, ${v.mibRate} per MiB of response data and ${v.creditRate} per analysis credit, before tax. Data overage is calculated on the exact number of extra bytes, not rounded up per request.

You must choose a monthly cap between ${v.capMin} and ${v.capMax}, in ${v.capStep} steps. ${v.capDefault} is suggested, but nothing is enabled until you confirm. The cap covers the combined request, data and credit overage before tax. When the next request or job could take you past the cap, it is refused instead. Warnings appear at 50%, 80% and 100% of the cap. You can lower the cap or switch overage off at any time; that stops further paid usage but does not cancel charges already incurred. The dashboard shows the overage so far and an estimate of your next invoice.

## What is never charged

We do not charge for failed, refused, timed-out or internally retried work, and there is never an uncapped overdraft. If billing confirmation is delayed, the application still enforces your limits.

## Payment and invoices

API access costs ${v.price} a month, including tax at the base GBP price; Stripe shows the final charge before you pay. Overage, when enabled, appears on the next invoice. Organisers manage payment details, invoices and cancellation from [Developers](/developers). Read [Cancelling API access and refunds](/knowledge/data-api/api-cancellation-and-refunds) and the [API purchase terms](/legal/membership).

## Browser Reach for API organisers

While your API account has settled coverage, its organisers also receive a browser Reach allowance in the Atlas: ${v.apiReachPerHour} new calculations an hour, up to ${v.serviceLibraries} eligible libraries per service, with a combined ceiling of ${v.apiReachPerDay} new calculations a day for the API account. Members do not inherit it. It is separate from the API's own analysis credits.`,
    },

    "team-api-reference": {
      title: "API reference: scopes, errors and troubleshooting",
      summary:
        "Authentication, key scopes, pagination, response headers, error codes and what to do when a request fails.",
      body: `Use \`https://libraries.global\` over HTTPS and send \`Authorization: Bearer YOUR_API_KEY\` with every request. The [request reference](/developers/reference) lists every endpoint, parameter and response field. This guide explains the rules they share.

## Scopes

- \`search:read\`: library search
- \`libraries:read\`: library records, lists and places
- \`services:read\`: published library services and networks
- \`analysis:run\`: analysis and Reach jobs, which spend analysis credits
- \`submissions:write\`: new-library proposals and corrections for moderation

New keys get the three read scopes by default. Analysis and submissions must be confirmed when you create the key. Give each application its own key with only the scopes it needs.

## Pagination and records

Lists return at most ${v.pageSize} records. Pass \`meta.nextCursor\` back as \`after\` until it is null, keeping the same locale and filters. Treat cursors as opaque. Records change while you page, so store each record's \`entityRef\` and \`updatedAt\`. Encode an \`entityRef\` as one path segment, for example with \`encodeURIComponent\`. Only live content locales are accepted.

## Response headers

Successful responses include \`X-Request-Id\` and headers showing the remaining allowance and when the period resets. Responses are private to your key and must not be shared-cached.

## Errors

Errors look like \`{"error":{"code":"..."}}\`. Check the HTTP status and code before retrying.

- 400: the request is malformed or uses an unsupported locale, filter or cursor. Correct it before retrying.
- 401: the key is missing, malformed, expired, revoked or replaced. Do not keep retrying the same key.
- 403: the key lacks the scope, or the API account has no settled coverage. Ask an organiser.
- 404: the record, service, job or submission does not exist or is not yours.
- 413: the request body is too large.
- 429: a limit was reached. \`rate_limit\` and \`concurrency_limit\` mean slow down. \`quota_requests\`, \`quota_bytes\` and \`quota_analysis\` mean an allowance is used up. \`overage_cap\` means the next charge would pass your cap. Honour \`Retry-After\` where it is given.
- 502 or 503: an upstream or accounting problem, or a response that would exceed ${v.maxResponse}. Retry with backoff, or ask for a smaller page.

Failed requests do not use your allowances or credits.

## Troubleshooting

- **Nothing works after checkout:** wait until the dashboard shows settled access. A checkout return page alone does not activate the API.
- **401 straight after regenerating a key:** every application must switch to the new key; the old one stops at once.
- **403 on a new feature:** check that your key has the scope and that the feature is enabled for your account.
- **Repeated 429s:** reduce parallel requests to ${v.concurrent}, spread requests out, or check whether an allowance or your overage cap has been reached.

When you contact info@libraries.global, include the endpoint, HTTP status, error code and \`X-Request-Id\`. Never send your key, the Authorization header or payment details.`,
    },

    "api-playground": {
      title: "Using the API playground",
      summary:
        "Try real API requests in the browser with your own key. Playground requests are metered like any other.",
      body: `The [playground](/developers/playground) sends real requests to the versioned API from your browser, so you can try endpoints before writing code.

## Before you start

You need an API account with settled coverage and an existing key. Paste the key into the playground. It is kept only in the page's memory: it is not saved, logged or sent anywhere except the API. Reloading the page clears it.

## Playground requests count

The playground has no free or private shortcut. Each request uses your key's scopes, rate limits and allowances, exactly as your application would. Successful requests and their response data count towards your allowance; analysis jobs spend credits; with overage switched on, they can also count towards overage. Failed requests do not use the allowance. Nothing runs until you choose Run.

## Exploring

Browse places from countries down to regions and areas, search libraries, list a place's libraries and open a record. Each step is an ordinary request. Where your account has the features enabled, you can also read services, check a submission's status or start an analysis job.

## Moving to your own code

Copy the request the playground shows into your application. Keep the key on your server. Read the [reference, scopes and troubleshooting](/knowledge/data-api/team-api-reference) guide for errors and limits.`,
    },

    "api-services-submissions-and-analysis": {
      title: "Service data, submissions and analysis credits",
      summary:
        "Read library services, propose new libraries and corrections for review, and run bounded analysis and Reach jobs with analysis credits.",
      body: `These API features are introduced in stages and are enabled separately. Your dashboard and the [request reference](/developers/reference) show which are available to your account.

## Library services and networks

With \`services:read\` you can list published library services and networks, read one by its stable reference and list its published member libraries. Not every network is a public library service: the response states its kind. Membership comes from our records, not from your request. A library's membership of a service is not staff authority. Keep the source credits with the data.

## Submissions

With \`submissions:write\` you can propose a new library or a correction to a published record. Include your evidence or source and a unique idempotency key, so that a retry does not create a second proposal. Protected fields and arbitrary fields are rejected.

Every proposal enters the normal moderation queue. It is never published directly, and it is reviewed in the same way as anyone else's suggestion. A key cannot claim to act for a library's staff. You can check a proposal's status, but you will not see reviewer notes or private details. Submissions do not earn points or recognition for the API account. Accepted text and data are published under the [data licence](/legal/data-licence), so only submit material you have the right to share.

## Analysis and Reach

With \`analysis:run\` you can request summary analysis of a published service or area, and Reach for one library or a whole service. Costlier work runs as a job: you receive a job ID, check its status and then fetch the result.

Analysis credits are spent only when a new job completes:

- simple summary: ${v.summaryCredits} credit; richer summary: ${v.richSummaryCredits} credits
- one-library Reach: ${v.libraryReachCredits} credits
- service Reach: ${v.serviceReachCredits} credits
- network Reach, when enabled after a separate capacity review: ${v.networkReachCredits} credits

A cached identical result spends no credits, but fetching it counts as a request and its response data. Fetching a completed result again never spends another credit. A job that could not fit your remaining credits or overage cap is refused before it starts. A failed, cancelled or expired job returns its reserved credits.

Inputs are bounded. The API does not accept arbitrary polygons, coordinate lists, self-chosen service memberships or unbounded batches. Results stay below ${v.maxResponse}; large geometry is not available through the base API. Completed results are kept for a limited time, shown in the job status, and then deleted.

## Reading results

Reach models geographical proximity. It does not measure visits, admission or step-free access, and partial results stay partial. Read [Walking, cycling and service Reach](/knowledge/data-api/understanding-library-reach) before publishing a figure.`,
    },

    "exporting-from-the-atlas": {
      title: "Atlas exports and Reach limits",
      summary:
        "Export filtered library selections, download Reach results and understand who can run Reach and how much.",
      body: `Any signed-in account can export a filtered Atlas selection as CSV or GeoJSON. Individual library record downloads remain public. Exporting records and downloading a Reach result are separate actions.

## Export the library selection

Narrow the selection with filters or the map, switch to List and choose Export. CSV suits spreadsheets; GeoJSON keeps map points. Each export can include up to ${v.exportRows} libraries, and you can make up to ${v.exportsPerDay} exports in any rolling 24 hours. Narrow a larger selection first. These limits are for people using the Atlas; for regular or larger extracts, use the API.

## Keep sources and scope

Exports carry library identifiers, available visiting and contact details, locations and source information. Keep the source records, attribution, licences and retrieval dates with the data. Empty fields mean the record lacks that value, not that the answer is No.

## Who can run Reach

Reach is expensive to calculate, so it has its own allowances:

- Explorer accounts: no Reach calculations
- Contributors: ${v.contributorReach} new one-library calculations in any rolling seven days; no service or network Reach
- Organisers of an API account with settled coverage: ${v.apiReachPerHour} new calculations an hour, including service Reach, with a combined ceiling of ${v.apiReachPerDay} a day for the API account

Opening an identical saved result does not use a new calculation. Verified staff status does not change these allowances.

## Service size limits

Service Reach admits up to ${v.serviceLibraries} eligible libraries. With all four travel times, the service and its reporting area must fit within ${v.area4} and a ${v.span4} span. Choosing one travel time allows up to ${v.area1} and ${v.span1}. These are conservative bounding boxes, not land areas. Calculation time, raster cells and the shared queue are also limited, so a request within these sizes can still be unavailable.

## Download Reach results

Use Downloads in the Reach drawer for CSV, display GeoJSON or Analysis JSON. Analysis JSON keeps the selection, filters, source editions and unrounded results. Cumulative counts overlap and must not be added together. Display polygons are simplified. Publish the source year, reporting area, service and travel mode with any figure, and keep partial-data warnings with the result.`,
    },

    "api-cancellation-and-refunds": {
      title: "Cancelling API access and refunds",
      summary:
        "How to stop API renewal, what happens to access and overage, and how to ask for a refund.",
      body: `Stopping renewal and asking for a refund are separate. This guide covers both.

## Stop renewal

An organiser opens [Developers](/developers) and chooses Manage API billing, then cancels renewal in Stripe's billing page. You do not need to delete your account. Access continues until the end of the paid period. Your keys stop working when coverage ends, and you can revoke them at any time.

## Overage when you cancel

Overage already used in the current period stays payable and appears on the final invoice. To stop further overage straight away, switch overage off or lower the cap. Switching it off does not erase charges already incurred.

## Refunds and cancellation rights

If you are a consumer in the UK, you normally have 14 days from purchase to cancel. Asking for access to start immediately does not remove that right, but you may be asked to pay for the service already provided. Other rights may apply where you live. Request a refund through the transaction support route on your Stripe receipt, or tell us at info@libraries.global. Include the invoice reference and your account email; never send card details or passwords.

A full refund of the current period, or a payment dispute, ends paid access for that period. Partial refunds and refunds of earlier periods do not remove a later paid period.

## Payment problems

A failed renewal does not open a new allowance; requests are refused until payment settles. Before paying again after an uncertain payment, check your billing page and your Stripe receipt. Read the [cancellation and refund policy](/legal/cancellation-refunds) and the [API purchase terms](/legal/membership).`,
    },

    "deleting-an-account-with-api-access": {
      title: "Deleting an account that manages API access",
      summary:
        "What to do before deleting an account that organises an API account or staff workspace, and what is kept afterwards.",
      body: `Deleting your account is permanent. If you organise an API account or a staff workspace, a few things must happen first so that nobody else loses access by surprise.

## Before you delete

- If you are the only organiser of an API account, make another member an organiser, or cancel the API subscription and wait for it to end.
- If you are the last organiser of a staff workspace, hand the organiser role to another member, or remove an unused workspace.
- Revoke any API keys you no longer need. Keys belong to the API account, not to you, so they keep working for the organisation if it continues.

Deletion is refused while you are the only organiser others rely on, or while billing cannot be confirmed as stopped.

## A single-member API account

If you bought API access as an individual, deletion first cancels the subscription and revokes its keys. Any overage already incurred remains payable. Deletion does not give a refund automatically; ask for one separately if you believe one is due.

## What is kept

Published public facts and accepted contributions stay, without your name. Minimal billing references are kept for six years for tax and accounting and cannot sign you in or restore access. Usage records do not contain request text, request bodies, IP addresses or keys. Stripe keeps its own financial records under its privacy terms.

Read [Deleting your account](/knowledge/getting-started/deleting-your-account) and the [privacy notice](/legal/privacy).`,
    },

    "sponsoring-libraries-global": {
      title: "Sponsoring Libraries Global",
      summary:
        "How organisations can fund the public service, what sponsors receive, and the independence rules that apply to every sponsorship.",
      body: `Sponsorship funds Libraries Global as free public infrastructure. It pays for programmes such as public access, data quality work, translation, geographic coverage and open tooling.

## Suggested levels

We discuss each sponsorship individually. As a starting point:

- Community Sponsor: ${v.sponsorCommunity} a year
- Service Sponsor: ${v.sponsorService} a year
- Founding Sponsor: ${v.sponsorFounding} a year

These are suggestions for a conversation, not packages with automatic benefits. Each agreement is quoted and contracted separately, usually by invoice, with its tax treatment confirmed in the agreement.

## What sponsors receive

With the sponsor's consent, we publish its name, and its logo if it wishes, in our sponsor acknowledgements, with a factual description of what the sponsorship supports. Sponsors receive quarterly activity updates, an annual impact report and briefings.

## Independence

Sponsorship never affects library records, search results or ranking, staff verification, moderation or editorial decisions. Sponsors do not review content before publication. We may decline or end a sponsorship that would compromise that independence.

## Not a donation

Sponsorship is a commercial agreement. It is not a charitable donation and should not be treated as tax-deductible unless our legal status changes and we say so.

## API access is separate

Sponsorship does not include API access or analysis capacity. A sponsor that needs the API subscribes to it like any other customer, or agrees a separately priced arrangement in writing.

## Get in touch

Send an enquiry through the contact form or email info@libraries.global with your organisation's name and what you would like to support.`,
    },
  },

  /** Short managed note added to related existing guides. */
  relatedNote: {
    heading: "Recognition and plans",
    text: "Accepted contributions earn Contributor status and, at 100, Supporter recognition. Recognition never unlocks editing rights or paid tools.",
    links: [
      [
        "Contributor and Supporter recognition",
        "/knowledge/contributing/earned-recognition-and-rewards",
      ],
      ["Plans and pricing", "/knowledge/governance/plans-and-pro"],
    ],
  },

  /** Link labels left by earlier rollouts, renamed when related guides are scrubbed. */
  linkLabels: {
    "Plans and Pro": "Plans and pricing",
    "Plans & Pro": "Plans and pricing",
    "Team API access": "API limits, overages and billing",
    "Team API access and allowances": "API limits, overages and billing",
    "Signup, API keys and your first request":
      "API: your first key and request",
    "Team API request reference":
      "API reference: scopes, errors and troubleshooting",
  },
})
