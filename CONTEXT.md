# libraries.global

A definitive global atlas of library institutions — every significant public, national, academic, monastic, parliamentary, cultural, and archival institution in the world, navigable by geography.

## Language

**Library**:
Any institution organised around the preservation or provision of recorded knowledge — books, manuscripts, archives, digital collections — that serves some defined constituency (general public, members, students, researchers, or humanity at large). The defining criterion is _institutional character_: a formal organisation, not a personal collection or informal reading space.
_Avoid_: venue, facility, location, place

**Operational Status**:
The current accessibility state of a Library. `appointment_only` means the Library is closed to walk-ins but open to pre-booked visits (typical of restricted archives). `seasonal` means the Library physically closes for part of the year (e.g. a rural library shut in winter). Other values — `open`, `temporarily_closed`, `permanently_closed`, `planned`, `unknown` — are self-evident.
_Avoid_: status (alone — too generic)

**Area**:
An optional recognised administrative or political subdivision that sits between a Region and its Libraries when the Region is large enough to warrant it (e.g. a London borough within Greater London). Not every Region has Areas.
_Avoid_: district, zone, neighbourhood (use the official unit name for display, but the concept is Area)

**Event**:
A happening hosted by a Library — talk, exhibition, storytime, workshop, tour, etc. — ingested automatically from a Source Provider and linked to exactly one Library. Events are ephemeral: deleted when expired, never manually curated. A city-wide happening spanning multiple venues is represented as N Events, one per participating Library.
_Avoid_: occurrence, happening, listing

**Source Provider**:
An external system that supplies Event data — either a ticketing/aggregation platform (Eventbrite, TicketSource, WeGotTickets), a raw iCal feed, or a library management system (Aspen, Solus, Spydus). Each Source Provider requires its own credential stored in Strapi.
_Avoid_: integration, feed, data source

**Event Feed**:
A Library's connection to one Source Provider: one Event Credential and the Libraries it feeds. A claimant or staff connects it; it is active, paused or waiting for review.
_Avoid_: integration

**Event Credential**:
The stored, encrypted values (tokens, keys, feed URLs) a Source Provider needs, kept on the Event Feed's row. Write-only for everyone except Strapi admin users with the Reveal permission.
_Avoid_: secret (alone — too generic), token (only one of several value shapes)

**Dataset**:
An external body of data imported into the index — a published list of libraries — registered in Strapi with its publisher, source address, licence and licence URL, whether that licence has been confirmed in writing, whether redistribution is permitted, the credit it requires, its coverage, the import mechanism, dates and notes. A library points at each Dataset through `sourceRecords[].dataset`, which equals the Dataset's `key`. Distinct from a Source Provider, which supplies Events, not records.
_Avoid_: data source, feed, import (for the registry entry itself)

**Source Record**:
An entry in the library's repeatable `sourceRecords` component. An imported entry keeps the Dataset's key, its own record ID (for IMLS, `FSCSKEY-FSCS_SEQ`), retrieval date and URL. A public reference has a URL, optional label and the fact fields it supports; it needs no Dataset or invented import ID. `role: origin` identifies original provenance for Drive scope and search; `reference` identifies supporting citations. Approved references append without replacing imports. Ingests match by Dataset and record ID; the shared runner skips known matches. Dataset credit and licence metadata stay in the registry.
_Avoid_: external ID, foreign key

**Wiki**:
Public-facing technical documentation for the platform — API usage, data scope, how to contribute, how to interpret the data model. Editable by the community via the Submission system (`wiki_edit`). Not a subject-matter encyclopaedia about libraries. Users see it as **Knowledge** (`/knowledge`, pages are "Knowledge articles"); code, CMS and Submission types keep the `wiki` names.
_Avoid_: encyclopaedia, docs, docs site

**Wiki Author**:
The original editorial author of a Wiki article — a freetext name, used for guest writers, historical attributions, or staff editors who predate the user account system. Stored as a plain string on the article. Not linked to a user profile.
_Avoid_: contributor (use Wiki Contributor for that), editor

**Wiki Contributor**:
Any user whose `wiki_edit` Submission has been approved on a given article. Stored as a many-to-many relation from the article to `user-profile`. Additive — every approved editor is added to the list, never removed. Displayed on the article page as a linked avatar list. Distinct from Wiki Author.
_Avoid_: author (that is the original editorial attribution), editor

**Blog**:
Editorial and narrative content — stories, features and community writing. Signed-in members can submit stories and revisions to their own work through `blog_submission`; Journal editors can revise other authors' work within their language grants. Publication follows scoped review. `publicationOrigin` distinguishes From the Index from community stories without changing authorship. Users see it as the **Journal** (`/journal`); code and CMS keep the `blog` names.
_Avoid_: posts, news

**Submission**:
A user-initiated change request recorded through the contribution system. Covers corrections to existing entries, new Library proposals, Library Claims, wiki and blog contributions, topic suggestions and Role Applications. Each carries the locale it was written in (stored as `contentLocale`), which decides which Moderators may review it and which language version an approval changes. Community submissions enter a Moderation Queue before data changes. An approved Library's own staff can publish ordinary record edits directly through an audited Submission, under ADR-0006; changes to placement, address, coordinates, type, slug, entity reference, home base or permanent closure still need a Moderator.
_Avoid_: edit, change request, contribution (alone — too generic; use the specific type)

**Submission State**:
Where a Submission is in moderation: `draft` (saved, not sent) → `pending` (waiting for review) → `approved`, `rejected` or `needs_info` (the reviewer asked for more). `needs_info` returns to `pending` when the submitter edits and finalizes the returned draft; a moderator can also approve or reject it directly. `approved` and `rejected` are final. A staff publish alone may go directly from `draft` to `approved`, without awarding Points. These transitions are allowed by content-moderation `utils/transitions.ts`, each is logged as a Review Event, and approval side effects (applying the change, awarding Points) run once. Users see Draft, Submitted, Needs changes, Accepted and Not accepted.
_Avoid_: status (alone — clashes with Strapi's document `status`, which the content-manager shows as `published` for every Submission)

**Library Claim**:
A Submission in which a user asserts a trusted relationship to a specific Library — either as an employee or institutional affiliate, or as a verified community member who wants to steward that Library's data. Approval gives the claimant a `verified_librarian` Role Grant and Staff access to that Library through a `library-affiliation` with `source: "claim"` (an older affiliation with no `source` is a legacy claim). Staff publish ordinary edits, post Notices and decide community corrections about their own Library; the sensitive fields in ADR-0006 still go to Moderators. A proposer affiliation gives no Staff access. A claim is one of two ways in: the other is a Team Organiser's assignment on a verified Team, which creates the affiliation (`source: "team"`) with no Moderator; on an unverified Team the assignment files a vouched claim instead. There are no per-library email invites.
_Avoid_: ownership claim, takeover, invite (a Team invite joins a Team, not a Library)

**Staff Role**:
A Library-specific level on an approved affiliation: `owner` or `editor`. Both can edit the record, post Notices, connect Event Feeds and review other people’s community corrections. Owners also control live sharing; when the Library is covered by a Team they can change levels, remove staff and set who may go live, and the Team Organiser can invite colleagues and assign them. The first approved claimant of a Library becomes its owner and later ones editors, unless an assignment says otherwise; the last owner can't leave or be demoted. Staff Role is separate from Contributor Role and Entitlements; no payment, sponsorship or recognition grants Staff access, and workspace membership gives none until the organiser assigns the person to a Library.
_Avoid_: global staff role, admin, team role (that is organiser or member within a Team)

**Staff Publish**:
A change a Library's own staff make to its record, timetable or Notices from the Staff area, which appears at once (ADR-0006). It is recorded as a `library_edit` Submission that goes `draft → approved` in one transaction, a Review Event with `reviewerKind: "staff"`, and Change Records with `source: "staff"`; it earns no Points. The moderated fields (placement, map location, street address, a Mobile service's home base, type, slug, entity reference, permanent closure) are split off into a pending `library_edit` request instead. A stale field, changed by someone else after the editor loaded it, is refused and reloaded rather than overwritten.
_Avoid_: direct edit (alone), admin edit, instant edit

**Staff Drawer**:
The pull-out panel that opens from any page for someone with Staff access: a fixed edge tab on wide screens, `Alt+S`, or "Staff drawer" in the user menu. It shows one Library at a time (the page's Library when the viewer is its staff, else the last used): the live strip for a Mobile Library, suggestions waiting, quick links to each Staff area tab and the public page, Drives that include the Library, and "Open staff area". Never shown on the Atlas, the live console or inside the Staff area.
_Avoid_: sidebar, staff menu, panel (alone)

**Contribute Menu**:
The header's Contribute panel: one small card per kind of work the viewer can do, combined for someone with several roles (their own work first, then Drives and Contribute for everyone, with Membership as a row at the bottom). Built from the session's Capabilities, Staff access and Teams, never from the displayed Contributor Role or the Standing. It opens signed out too, with a sign-in card, and shows only the Everyone cards until the session has loaded. The mobile menu's Contribute section and the footer's editor pills read the same cards.
_Avoid_: Contribute dropdown, role menu, shortcuts (alone)

**Team**:
An organisation on the site (`plugin::access.team`), shown to people as a **staff workspace**: a name, its Team Members, one or more organisers, the Libraries it covers, and whether an admin has verified it (`verifiedAt`). Any verified-email account can create one free of charge; covering a Library still needs verified owner authority on it. It has no seats or payment state. Verification is set only by an admin, never by payment: on a verified Team an assignment creates Staff access at once; on an unverified one it files a vouched Library Claim. Library-scoped staff tools (Traffic, choosing who can go live, team view, embeds, bulk upload) come from each person's own verified staff access (`canStaff`), never from membership. A Team can also own one API Account.
_Avoid_: team plan, seat, paid workspace

**Team Member**:
A person's row in a Team (`plugin::access.team-member`): their email, Better Auth id once they accept, a team role of `organiser` or `member`, and a status of `invited`, `active` or `removed`. Invited by email, accepted by signing in with that address. A member has no Staff access until assigned to a Library. Removal deletes only the affiliations the Team created.
_Avoid_: seat, staff (that is per Library), employee

**Team Organiser**:
The Team Member with `teamRole: organiser`. Invites colleagues, changes team roles, assigns and unassigns members to the Team's Libraries as owner or editor, and removes members, from `/staff/teams`; on an API Account, organisers also own billing, keys and overage settings. The organiser's trust comes from the Team's verification and their own staff access, never from payment. The last organiser must hand over before deleting their account.
_Avoid_: admin, team owner, manager

**API Account**:
The paid machine-API subscription of one organisation (a Team; an individual buyer gets a single-member organisation at checkout). One active subscription per organisation, £100/month. Each settled billing period (`[start, end)` of the Stripe subscription item, UTC) pools 10,000 successful requests, 262,144,000 response bytes and 100 analysis credits across all keys. Overage is opt-in and capped by the organiser (£10–£500 before tax). Organisers manage it at `/developers`; members see usage. Organisers with settled coverage receive the browser Reach bonus (the `apiCustomer` fact). It gives no Staff access, Capability, user session or protected data. Limits are snapshotted with the purchase. See `apps/ui/TEAM-API.md`.
_Avoid_: Team API add-on, personal API subscription, paid staff permission

**API Key**:
An API Account's machine credential for scoped public API operations (`search:read`, `libraries:read`, `services:read`, `analysis:run`, `submissions:write`; new keys default to the read scopes). The full value is shown once; only its digest and display prefix are retained. An organiser can regenerate or revoke it. Key count is unlimited and every key shares the account's allowances; its creator is an audit actor, not the identity of API requests.
_Avoid_: user token, Strapi token, Meilisearch key (those are separate upstream credentials)

**Library Notice**:
A dated, immediately published message from a Library’s staff about a temporary closure, changed hours or a Mobile service disruption. Mobile notices may cover a service, a Cycle day or a Stop, and a `not_running` notice cancels the Visits in its scope on its dates. Dates are inclusive in the Library’s timezone; an open-ended notice covers 30 days. Its `source` is `staff` (the Notices tab), `live` (the console's "Not running", which posts one for the rest of today and ends the Live Session) or `admin`. Notices affect visitor information, search and timetable cancellations, and never change the permanent record status.
_Avoid_: permanent closure, Event, alert

**Mobile Timetable**:
A Mobile Library’s recurring route (`mobileTimetable`, one per vehicle, not localised): a Cycle, its Stops and the Visits to them, with holidays and dated exceptions. Route order follows arrival time. The public page derives upcoming visits in the service’s timezone, and the `mobile-stop` search index holds one document per mapped Stop. Live sharing is separate and never changes scheduled visits.
_Avoid_: opening hours of the base, live route, schedule (alone)

**Stop**:
A named place a Mobile Library visits: a name ("Ford Cross"), where exactly ("Lay-by opposite the Plough Inn"), a map pin and the Area the pin falls in. A Stop has a stable id that is never reused, so corrections and search keys survive edits. A Stop with no pin isn't mapped; one with no Visits isn't shown.
_Avoid_: location, site, venue, station

**Visit**:
One scheduled call at a Stop: a weekday, an arrival and a departure on a five-minute grid, how it repeats (chosen weeks of the Cycle, the nth weekday of the month, or specific dates), whether it runs in term time only, and an optional validity window. Two Visits on the same date never overlap, because the vehicle can't be in two places at once. A Visit on a date is an occurrence; a `not_running` Library Notice cancels occurrences without removing the Visit.
_Avoid_: slot, session (that is a Live Session), stop time

**Cycle**:
The repeating period of a Mobile Timetable: one to four weeks, anchored on the Monday that starts Week 1. Every date falls in exactly one week of the Cycle, so "Tuesday, Week 1" names a route. Repeats, notices scoped to a Cycle day and the "next four weeks" preview all count from the anchor.
_Avoid_: rota, rotation, period (alone)

**Live Session**:
One run of a Mobile Library's live sharing from the `/live` console: started by a staff member who may go live, for one service date and Cycle day, in check-ins or approximate-position mode, with a per-device token. Check-ins (arrived, left, delay, skip) fold into its public state; the public sees the vehicle's state and Stop, never a name. It ends by hand, after the last departure plus the auto-stop, by a breakdown notice, by a takeover from another device, by revocation (staff removed, "can go live" off, sharing off), by the 12-hour cap or by the kill switch, and every end clears the position. One active Live Session per Library; sessions and their events are kept 90 days.
_Avoid_: trip, track, broadcast, route (that is the day's Visits)

**Verification**:
A Submission (`correction` with `kind: "verify"`) confirming that some of a Library's sections (hours, status, address, contact) are still right, without changing them. Approval stamps each section in `verifiedSections`; an approved edit stamps the sections it sets. `lastVerifiedAt` is the latest stamp.
_Avoid_: check-in, confirmation (as a type name)

**Saved Library**:
A user's bookmarked Library — a wishlist of institutions they want to visit or want to remember. Not a visit record. Saving a Library drives two downstream effects: (1) the Library surfaces in a "Your libraries" filter on the Events browse and Library index, and (2) the user receives in-app and email notifications when significant data changes are approved for that Library (status change, opening hours, new Events).
_Avoid_: favourite, bookmark, visited library

**Points**:
The unit of contribution credit awarded when a Submission is approved. Drive Tier progression and Badge eligibility. Tracked as a cumulative all-time total; cannot be spent or traded. Point values by submission type: a structured record `correction` or `library_edit` → 5pts (1–3 changed fields) or 15pts (4+), or 2pts when no field differs from the record; a free-text `correction` or a Verification → 2pts, plus 5pts each for confirming or changing hours or open status; a shared photo → 8pts; `library_claim` approved → 10pts; `wiki_edit` approved → 5pts; `wiki_edit` translation → 15pts; `new_library` approved → 50pts.
_Avoid_: credits, score, karma

**Tier**:
A prestige level computed from a user's all-time Points — Reader (0), Indexer (100), Cartographer (500), Archivist (1 500), Scholar (4 000), Curator (9 000). Scales contribution limits only (pending submissions, submissions per hour, uploads per day: `contributionLimits` in `@repo/access`; `wiki_editor`, `journal_editor`, `moderator` and `editorial_board` get Curator limits). It never unlocks tools or Recognition, which count accepted contributions rather than Points. Never confers trust: no Tier skips review or grants a Capability.
_Avoid_: level, rank, grade

**Badge**:
A permanent achievement awarded to a user when they hit a specific contribution milestone (e.g. 10 verified opening-hours checks → Verifier badge). Defined in code, not as a content type; new badges require a deploy.
_Avoid_: achievement, award, trophy

**Streak**:
The number of consecutive calendar days on which a user had an approved contribution. Resets if a day is missed; does not increment twice in one day.
_Avoid_: combo, run, activity count

**Moderator**:
A community member with authority to approve, reject, or request more information on Submissions within their Moderation Scope: anyone holding a `moderator` Role Grant, and the editorial board for every queue and locale. Moderators review on the site at `/moderation`, where Strapi re-checks their scope on every request; the owner can also review from the Strapi admin queue. Nobody reviews their own Submission, and no Moderator lets one skip review.
_Avoid_: admin, reviewer (alone — too generic)

**Contributor Role**:
A level of trust that gates privileged platform features, held through Role Grants. Distinct from Tier (earned with Points; changes limits only) and Entitlements (tools and limits from Access Facts). Values in ascending privilege order: `reader` (no grants), `contributor`, `verified_librarian`, `wiki_editor`, `journal_editor`, `moderator`, `editorial_board`. A person can hold several at once, each with its own scope: `wiki_editor` and `journal_editor` edit Knowledge or Journal articles directly in the locales of their grants, `moderator` reviews Submissions in its Moderation Scope, and `editorial_board` does all of that in every queue and locale. Staff grant roles in Strapi admin; an approved Library Claim (or an email-domain auto-verification) grants `verified_librarian`, and an approved Role Application grants an editor role. They are never earned with Points or bought. The profile's `contributorRole` shows the highest role for display and is derived from the grants, never written directly. Grants reach the Better Auth session through the `session-profile` bridge, which Strapi reads on every session request, so a grant change shows on the next request.
_Avoid_: permission, access level, tier (Tier is the Points-based system)

**Role Grant**:
A row that gives one person one Contributor Role, optionally scoped to a Moderation Queue and a locale, with who granted it, why, and an optional expiry. A person's Contributor Roles are the union of their unexpired grants; someone with none is a `reader`. Stored in the admin-only `role-grant` collection (the locale as `scopeLocale`).
_Avoid_: permission, U&P role

**Moderation Queue**:
Where a Submission waits for review: `index` (library submissions), `knowledge` (Knowledge contributions), `journal` (Journal contributions) or `applications` (Role Applications), with `discussions` for the portable discussion review workflow. Every content-moderation Submission type maps to one queue; discussion records and immutable revisions have their own plugin lifecycle.
_Avoid_: inbox, backlog

**Moderation Scope**:
The (queue, locale) pairs a Moderator may review, one per `moderator` Role Grant. The `all` queue and no locale mean unrestricted.
_Avoid_: permission, remit

**Role Application**:
A Submission asking for an editor or scoped moderator role, for every language or only some, reviewed in the `applications` queue. Moderators may request Index, Knowledge, Journal or Discussions; discussion applications have no article-section selection. Open to anyone with five accepted Submissions, no open application for that role and no grant that already covers it; never related to Recognition, payment, Tier or Points. Approval creates the Role Grants and awards no Points.
_Avoid_: promotion, role request

**Review Event**:
One Submission State transition: from, to, reviewer, note and when. Append-only; together they are the review thread on a Submission.
_Avoid_: comment, history (alone — too generic)

**Review Lock**:
A two-minute lease a Moderator holds on a Submission while its review page is open, renewed while the page is visible and released by a decision or by leaving. Others see who holds it and can't decide or edit the Submission until it expires or they take it over (ADR-0008). Advisory for reading, enforced for writes; the decision's compare-and-set remains the final guard.
_Avoid_: claim (a Library Claim is something else), assignment

**Change Record**:
One field of one Library changing once: previous value, next value, who, when, why (which Submission, if any) and from which source (a Submission, an admin, an API token, an import or the system). Recorded for every write, including admin edits and imports, and retained as audit history. Account erasure clears actor and reviewer identifiers without deleting the public changes. The Change Records from one write form a **Change Batch**. A Library's public Changes section names the fields; their values require the `library.history` Entitlement, which every signed-in Explorer has.
_Avoid_: revision, audit log entry

**Article Change**:
One edit event on a Knowledge or Journal article: who, when, locale and kind (created, edited, translated, published, unpublished or deleted). No body diff.
_Avoid_: revision, version

**Capability**:
Something a signed-in user may do in the contribution system: submit a correction, a new Library, a Library Claim, a doc suggestion, a journal pitch, a topic suggestion or a Role Application; submit a `library_edit` or connect an event feed for a Library they are staff of (by claim or Team assignment); edit Wiki or Blog articles directly (`docs.directEdit`, `journal.directEdit`, in the locales of the editor's grants); or review Submissions (`moderate.queue`, within a Moderation Scope). Resolved only from Role Grants and Library Claims (`resolveCapabilities` in `@repo/access`); Tier, Recognition and Entitlements never feed it. Strapi's `submission-policy` is the real gate; the session's copy drives the UI and route pre-checks only.
_Avoid_: permission (Strapi admin's word for its own roles), entitlement (that is what Access Facts give)

**Entitlement**:
A feature or numeric limit resolved from independent Access Facts, such as the `atlas.export` feature or the `exportRows` limit (Explorer 10 000 rows per export, 20 exports per rolling day). Resolved by `resolveEntitlements` in `@repo/access` and always enforced on the server (`requireEntitlement`); UI locks only explain. An Entitlement never grants a Capability or changes Points, Tier, Badges, Contributor Role, staff access or moderation: money never buys trust. Staff tools are not Entitlements; they are staff capabilities (`canStaff`) from verified staff claims on named Libraries.
_Avoid_: capability, perk, permission, plan

**Access Fact**:
One independent reason an account has Entitlements, replacing the ranked Plan: `explorer` (any signed-in account: browse, comparison, context layers, alerts, notes, history, saved views and exports within fair-use limits; no Reach), `contributor` (Recognition at 1 accepted contribution: two new one-library Reach calculations per rolling seven days), `supporter` (Recognition at 100 accepted contributions: no tools or quota) and `apiCustomer` (organiser of an API Account with settled coverage: 20 new browser Reach calculations an hour, pooled 100 a day per API Account, service Reach up to 50 Libraries). The session carries `standing` (`public`, `explorer`, `contributor` or `supporter`), `facts`, `features` and `limits`; `plan`, `planSource` and `teamLibraryIds` are gone.
_Avoid_: plan, tier, membership level

**Explorer**:
Any signed-in account, free. The customer-facing name for the `explorer` Access Fact.
_Avoid_: free plan, basic

**Recognition**:
Earned thanks for accepted, substantive contributions, counted per accepted submission or suggestion (`acceptedContributions` and `lastContributionAt` on the profile, incremented once per qualifying positive award) rather than from Points. **Contributor** from 1, **Supporter** from 100; durable, with a separate 30-day "recently active" status. Administrative adjustments, streaks and automatic bonuses never count. A moderator can revoke it for fraud or duplication (`recognitionRevokedAt`). Recognition never grants editing rights, staff verification, moderation or API access. Supporters can appear on `/community/supporters` and show a Supporter mark, subject to the independent privacy preferences `supporterListed` and `supporterBadgeVisible`; only public profiles are listed.
_Avoid_: earned Pro, paid supporter, trust badge

**Verified Staff**:
The customer-facing name for people with Staff access through an approved Library Claim or a verified Team assignment. Their tools are free and scoped to their own Libraries.
_Avoid_: Team plan, paid staff

**Sponsor**:
An organisation funding the public service under an annual agreement, recorded in the admin-only `sponsor` collection (organisation, tier anchor, term, recognition consent, logo, acknowledgement text, published flag) that drives the acknowledgement surface. Suggested anchors are £2,500, £5,000 and £10,000 a year. Not a charitable donation; it includes no API access and never feeds Entitlements, capabilities, ranking or moderation.
_Avoid_: donor, patron, paid partner

**Collection Stat**:
A single data point describing what a Library _holds_ — volumes, manuscripts, maps, incunabula, digital objects, etc. Free-form `category` + `value` pairs today, with potential to become a structured collections API in the future.
_Avoid_: holding, asset

**Library Stat**:
A single data point describing how a Library _operates_ — annual visitors, staff count, floor area, budget, etc. Free-form `label` + `value` pairs, display-only.
_Avoid_: metric, figure, stat (alone — too generic)

**Gap**:
A record section a Library lacks, as `packages/shared-data/gaps.ts` defines it: photo, hours, address, location, facilities, about, history, contact (the eight completeness sections), accessibility and services. Strapi stores each library's gaps beside its completeness; the search index's `needs` is that list.
_Avoid_: missing field, hole, need (in prose)

**Entity Reference (entityRef)**:
A stable, globally unique, human-readable identifier for any entry in the content hierarchy (Continent, Country, Region, Area, Library). It is hierarchically composed from the slugs of its ancestors, colon-separated, making the full path readable without a database lookup. Library entityRefs include the Area slug when a Library belongs to an Area (`europe:united-kingdom:greater-london:camden:barbican-library`), and omit it otherwise (`europe:united-kingdom:scotland:national-library-of-scotland`). Auto-generated; never assigned manually.
_Avoid_: ID, slug, shortcode

**Pillar Institution**:
A Library of exceptional cultural, historical, or national significance, designated by editorial judgement — not by formula. Examples: the British Library, the Library of Congress, the Library of Alexandria. Any number of Pillar Institutions may exist within a Region or Country. Stored as `featured: true` in the data model.
_Avoid_: featured library, highlighted library, top library

**University Library**:
A Library that is part of a degree-granting university. Distinct from Academic Library.
_Avoid_: academic library (when the institution is a university)

**Academic Library**:
A Library attached to a research institution, government agency, or non-university body that conducts academic or scientific work — e.g. a government agency's research library, a think-tank's archive, a specialist research institute. The institution is academically oriented but does not grant degrees.
_Avoid_: university library (when the institution is not a university), research library (too vague)

**Region**:
A first-level administrative subdivision of a Country (state, province, county, département, etc.). Every Library belongs to a Region, either directly or through an Area.
_Avoid_: province, state, county (those are display names; the concept is Region)

**Place Labels**:
The four localised strings on a Country that name its Regions and Areas in the UI: `regionTypeLabel` and `regionsSectionLabel` (singular, plural), `areaTypeLabel` and `areasSectionLabel`. Display only; they never change routing, hierarchy or data.
_Avoid_: region type, area type (those are the per-place `typeLabel`)

**Country Profile**:
One entry per country in the world place import's profile file: its Place Labels, which source level is its Region and which its Area, whether it opts in to filling gaps, and an optional curated source.
_Avoid_: country config, country settings

**Noticeboard**:
The `/community` page: board-run Drives alongside the leaderboard and option-suggestion voting. Shows the Drive Focus filter, the Featured or Pinned Drive as the big card, every other open Drive, and recently finished ones.
_Avoid_: dashboard, community page (alone — Noticeboard is the proper name)

**Drive**:
A board-run, time-boxed call to fill a Gap across a scoped set of Libraries — a Noticeboard campaign with a start and end date, a goal percentage, and one to five steps contributors follow. Created and run only by the `editorial_board` (`drives.manage`); contributed work arrives as ordinary Submissions tagged with the Drive's `driveDocumentId` and is credited on approval. `draftAndPublish` is off: its own `status` (draft → scheduled → open → closed/cancelled) is the only lifecycle, advanced hourly by the `driveLifecycle` cron.
_Avoid_: campaign, challenge, event (Event is a different content type)

**Drive Scope**:
Which Libraries a Drive can touch: an explicit list, or by place (continent/country/region/area), Library type, Dataset source or a completeness ceiling — always excluding permanently closed Libraries. One definition (`packages/shared-data/drives.ts`) renders it as a Meilisearch filter and as a predicate over a single Library, so Strapi and the UI never disagree on who's in scope.
_Avoid_: filter (alone — too generic), criteria

**Focus**:
What a Drive asks contributors to fill within its Drive Scope: specific Gaps (`gaps`), re-confirming sections before a cutoff date (`verify`), or raising every in-scope Library's completeness to a target (`record`). Decides both the Meilisearch "to do" filter and whether a given Submission's fields count as progress against the Drive.
_Avoid_: goal (that's the Drive's `goalPercent`), topic

**Drive Task**:
One Library in a Drive's open task list — a page of the Meilisearch `library` index, narrowed by the Drive's Scope and Focus, that the task panel hands a contributor to work on next.
_Avoid_: item, job

**Pinned Drive**:
A Drive the board has pinned to the Noticeboard's prominent rail, independent of Featured. At most six open or scheduled Drives may be pinned at once; pin order breaks ties for which shows first.
_Avoid_: sticky, highlighted

**Featured Drive**:
The one Drive the board has marked to fill the Noticeboard's big card outright. At most one Drive is Featured at a time; Featured beats a Pinned Drive, which beats the first open Drive, as the Noticeboard's big-card choice.
_Avoid_: pinned (Pinned is a separate flag; Featured always wins the big card)

**Drive Credit**:
A hidden ledger row (the `drive-credit` content type, no REST routes) linking one approved Submission to one Drive — explicitly tagged by the contributor, or inferred from the Drive's Scope and Focus matching the Submission's fields. Feeds a Drive's stats and leaderboard; never shown directly.
_Avoid_: credit (alone — clashes with Points), ledger entry

**Drive Proposal**:
A Submission (`drive_proposal`) asking for a drive, reviewed in the `index` queue. Proposing needs 5 accepted Submissions and no other open proposal. Approval schedules the drive (unpinned), and the editorial board pins it.
_Avoid_: drive request

## Relationships

- Every **Event** belongs to exactly one **Library** — even a multi-venue happening is N Events, one per Library
- A **Library** belongs to a **Country** → **Region** → optionally an **Area**
- An **Area** belongs to exactly one **Region**; not every **Region** has **Areas**
- An approved **Library Claim**, or a **Team Organiser**'s assignment on a verified **Team**, links a user to a specific **Library** and grants its **Staff Role** and Staff access
- A **Team** (staff workspace) covers one or more **Libraries** and holds **Team Members**; at least one is the **Team Organiser**. Membership gives nothing by itself; only an assignment gives a **Staff Role**. A Team can own one **API Account**
- A **Mobile Timetable** has one **Cycle**, many **Stops** and many **Visits**; a **Library Notice** can cancel a Visit's occurrences, and a **Live Session** reports progress along one day's Visits without changing them
- A **Staff Publish** leaves a **Submission**, a **Review Event** and **Change Records**, like any other change, and earns no **Points**
- **Points** accumulate per approved **Submission** and determine a user's **Tier** and **Badge** eligibility
- A user's **Capabilities** come only from their **Role Grants** (their **Contributor Roles**) and **Library Claims**, and their **Entitlements** only from their **Access Facts**. The two never feed each other; **Tier** feeds only contribution limits, and **Recognition** counts accepted contributions, not Points
- Every **Submission** moves through the **Submission States**; an audited staff publish uses `draft → approved` under ADR-0006. No payment, **Recognition** or **Tier** changes review authority
- Every **Submission** belongs to one **Moderation Queue**; a **Moderator** reviews it only when the queue and its locale are in their **Moderation Scope**, and never their own
- Every change to a **Library**'s content leaves **Change Records**, whoever made it; every write to a Wiki or Blog article leaves an **Article Change**
- A **Pillar Institution** is a **Library** flagged `featured: true` by editorial choice; there is no maximum per Region or Country

## Example dialogue

> **Dev:** "A user submitted a correction to the British Library's opening hours. Should that go into the moderation queue?"
> **Domain expert:** "Yes — every **Submission** goes through review. The British Library is a **Pillar Institution** but that doesn't change the flow."
>
> **Dev:** "What if the submitter has a **Library Claim** on the British Library?"
> **Domain expert:** "As approved staff, they can publish hours directly from the Staff area. Moving the library or marking it permanently closed still needs a Moderator. Their direct publish leaves a **Submission**, **Review Event** and **Change Records**, and earns no **Points**."
>
> **Dev:** "And if they get approved — do they earn **Points**?"
> **Domain expert:** "Community contributions earn Points when accepted: minor edits (1–3 fields) earn 5 and major edits (4+ fields) earn 15. A staff member accepting a community correction awards its contributor the normal Points; publishing their own record earns none."
>
> **Dev:** "A council has set up a staff workspace and bought API access. Does that make its librarians staff of every branch?"
> **Domain expert:** "No. The workspace is the council's **Team**: its **Team Organiser** invites colleagues and then assigns each one to a **Library** as owner or editor. On a verified Team that assignment is the **Staff Role**; on an unverified one it's a vouched **Library Claim** for a Moderator. The **API Account** only pays for machine access. Nobody is staff of a branch they haven't been assigned to, and no payment changes who reviews what."

## Model notes

- The `library` relation on the Event schema is not marked `required`, but every Event must belong to a Library — this is a schema gap to fix.
- `correction` and `library_edit` are both Submission types that change Library data. Resolved: `library_edit` is a comprehensive multi-field diff produced by the full edit wizard and requires a Library Claim; `correction` is a targeted single-issue report (category picker + freetext) available to any logged-in user with no claim required, produced by the inline correction CTA on library detail pages. Non-logged-in users see a "Sign in to suggest a correction" prompt. Approved staff use the full edit wizard in the Staff area. Their ordinary changes publish directly, while the sensitive fields in ADR-0006 become moderated `library_edit` requests.
- Event `pendingReview` is active: public event queries exclude pending records, and the Events admin review endpoints approve or discard them.
- Library `entityRef` is generated by `apps/strapi/src/lifeCycles/entityRef.ts` from geographic slugs and the library slug, including Area when present. It is a colon-separated identifier; public URLs omit Area.

- "public library" was used colloquially to mean _any library institution_ (not "open to the general public" or "publicly funded"). Resolved: **Library** covers all institutional types regardless of access model or funding source.

## Atlas library networks

A **Library Network** is a sourced institutional grouping, such as a public library service, university system or consortium. Libraries have non-localised many-to-many `networks` memberships. The network has a stable source key, name, kind, countries and source reference. Its identity is independent of geographic placement and of Teams; membership grants no staff authority.

Network is a reusable Atlas filter. Network Reach combines the full analytical catchments of the selected published, mapped, fixed-location Libraries, then clips them to a service reporting area derived from all eligible mapped members, before filters apply. The default area unions the supported districts containing those members; it does not assert an official jurisdiction. Selecting a service focuses its bounding box. Unrelated reporting-area combinations are rejected. It integrates the union and the area's denominator against the same population edition. Missing routes or population remain explicit; incomplete results cannot establish population gaps. Saved analytical choices do not alter institutional memberships.

Reach admits up to 50 eligible Libraries, with four travel times within a 2,500 km² / 75 km bounding envelope, or one selected time within 20,000 km² / 200 km. Who may start new calculations depends on Access Facts: Explorers none, Contributors two one-library calculations per rolling seven days (no service or network Reach), and organisers of a covered API Account 20 an hour, pooled 100 a day per API Account. Cached identical results are free. The machine API's analysis credits are a separate budget. Larger services require an explicit recalculation when the selected time changes; they do not receive invented intermediate bands. Both the Libraries and the complete reporting area must fit. These are bounded query allowances, not land-area measurements or an unlimited national analysis feature.

## Pricing and content operations

The agreed amounts are in `apps/ui/src/lib/membership-pricing.json`: the API at £100/month (tax-inclusive base GBP) with 10,000 requests, 250 MiB and 100 analysis credits per billing period, opt-in overage at 1p per request, 10p per MiB and 50p per credit under an organiser cap of £10–£500, and sponsorship anchors. Explorer, Recognition and Verified Staff are free. Personal Supporter/Pro purchases, paid Team seats, earned Pro and the £15 Team API add-on were removed in the November 2026 beta reset without grandfathering. See `apps/ui/PRICING.md`, `apps/ui/TEAM-API.md` and `apps/docs/docs/proposals/sponsored-access-decisions.md`.

Routine content work targets production; feature work uses local explicitly. Use the selected environment's authorized content workflow in `apps/strapi/CONTENT-OPERATIONS.md`. Connection details, enabled transports, credentials and environment-specific permissions belong in private operator storage.
