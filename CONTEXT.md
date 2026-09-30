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

**Dataset**:
An external body of data imported into the index — a published list of libraries — registered in Strapi with its publisher, source address, licence and licence URL, whether that licence has been confirmed in writing, whether redistribution is permitted, the credit it requires, its coverage, the import mechanism, dates and notes. A record points at the Dataset it came from through its `source` field, which equals the Dataset's `key`. Distinct from a Source Provider, which supplies Events, not records.
_Avoid_: data source, feed, import (for the registry entry itself)

**Source Record**:
The row in a Dataset that a library corresponds to, stored on the library as the Dataset's `key` and that row's own ID (for the IMLS survey, `FSCSKEY-FSCS_SEQ`). A library can have one from each Dataset that describes it. Re-running an import matches libraries by Source Record, not by name or slug, and a second Dataset uses it to add to a record that already exists.
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
Editorial and narrative content — stories, features, guest pieces — managed exclusively by editors and invited guest editors. Not community-editable; guest posts are submitted via the Submission system (`blog_submission`) and curated by editors. Users see it as the **Journal** (`/journal`); code and CMS keep the `blog` names.
_Avoid_: posts, news

**Submission**:
A user-initiated change request that enters a moderation queue before any data is altered. Covers corrections to existing entries, new Library proposals, Library Claims, wiki and blog contributions, and topic suggestions. All submissions go through review regardless of the submitter's trust level.
_Avoid_: edit, change request, contribution (alone — too generic; use the specific type)

**Submission State**:
Where a Submission is in moderation: `draft` (saved, not sent) → `pending` (waiting for review) → `approved`, `rejected` or `needs_info` (the reviewer asked for more). `needs_info` returns to `pending` when the submitter resubmits (their edit-and-resubmit flow is still to come, C-M1); a moderator can also approve or reject it directly. `approved` and `rejected` are final. Only these transitions are allowed (content-moderation `utils/transitions.ts`), and approval side effects (applying the change, awarding Points) run once. Users see Draft, Submitted, Needs changes, Accepted and Not accepted.
_Avoid_: status (alone — clashes with Strapi's document `status`, which the content-manager shows as `published` for every Submission)

**Library Claim**:
A Submission in which a user asserts a trusted relationship to a specific Library — either as an employee or institutional affiliate, or as a verified community member who wants to steward that Library's data. Approval grants the claimant a trusted-contributor signal on future Submissions, not a bypass of moderation.
_Avoid_: ownership claim, takeover

**Saved Library**:
A user's bookmarked Library — a wishlist of institutions they want to visit or want to remember. Not a visit record. Saving a Library drives two downstream effects: (1) the Library surfaces in a "Your libraries" filter on the Events browse and Library index, and (2) the user receives in-app and email notifications when significant data changes are approved for that Library (status change, opening hours, new Events).
_Avoid_: favourite, bookmark, visited library

**Points**:
The unit of contribution credit awarded when a Submission is approved. Drive Tier progression and Badge eligibility. Tracked as a cumulative all-time total; cannot be spent or traded. Point values by submission type: `correction` approved → 2pts; `library_edit` minor (1–3 fields) → 5pts; `library_edit` major (4+ fields) → 15pts; `library_claim` approved → 10pts; `wiki_edit` approved → 5pts; `wiki_edit` translation → 15pts; `new_library` approved → 50pts.
_Avoid_: credits, score, karma

**Tier**:
A prestige level computed from a user's all-time Points — Reader (0), Indexer (100), Cartographer (500), Archivist (1 500), Scholar (4 000), Curator (9 000). Scales contribution limits only (pending submissions, submissions per hour, uploads per day: `contributionLimits` in `@repo/access`; `wiki_editor` and `editorial_board` get Curator limits) and, from Archivist up, earns Pro (see Plan Source). Never confers trust: no Tier skips review or grants a Capability.
_Avoid_: level, rank, grade

**Badge**:
A permanent achievement awarded to a user when they hit a specific contribution milestone (e.g. 10 verified opening-hours checks → Verifier badge). Defined in code, not as a content type; new badges require a deploy.
_Avoid_: achievement, award, trophy

**Streak**:
The number of consecutive calendar days on which a user had an approved contribution. Resets if a day is missed; does not increment twice in one day.
_Avoid_: combo, run, activity count

**Moderator**:
A community member or staff editor with authority to approve, reject, or request more information on Submissions. A future role — not yet fully built — intended to distribute moderation workload beyond the core team.
_Avoid_: admin, reviewer (alone — too generic)

**Contributor Role**:
A permission level stored on a user's profile that gates access to privileged platform features. Distinct from Tier (earned with Points; changes limits only) and Plan (changes Entitlements only). Values in ascending privilege order: `reader` (default), `contributor`, `verified_librarian`, `wiki_editor`, `editorial_board`. `wiki_editor` and `editorial_board` can edit Wiki articles. Roles are assigned by staff in Strapi admin, except `verified_librarian`, which an approved Library Claim (or an email-domain auto-verification) sets; that never lowers a higher role. They are never earned with Points or bought. Stored in the user-profile record and read into the Better Auth session through the `session-profile` bridge, which is cached for 60 seconds per user (spec §3.2), so a role change takes effect within a minute.
_Avoid_: permission, access level, tier (Tier is the Points-based system)

**Capability**:
Something a signed-in user may do in the contribution system: submit a correction, a new Library, a Library Claim, a doc suggestion, a journal pitch or a topic suggestion; submit a `library_edit` or connect an event feed for a Library they have claimed; or edit Wiki articles directly (`docs.directEdit`, for `wiki_editor` and `editorial_board`). Resolved only from the Contributor Role and Library Claims (`resolveCapabilities` in `@repo/access`); Tier and Plan never feed it. Strapi's `submission-policy` is the real gate; the session's copy drives the UI and route pre-checks only.
_Avoid_: permission (Strapi admin's word for its own roles), entitlement (that is what a Plan gives)

**Entitlement**:
A Plan-gated feature or numeric limit, such as the `atlas.export` feature or the `exportRows` limit (free 0, pro 10 000, team 50 000). Resolved by `resolveEntitlements` in `@repo/access` from the user's Plan and always enforced on the server (`requireEntitlement`); UI locks only explain. An Entitlement never grants a Capability or changes Points, Tier, Badges, Contributor Role or moderation: money never buys trust.
_Avoid_: capability, perk, permission

**Plan**:
A user's membership level, which decides their Entitlements: `public` (signed out), `free` (any account), `supporter` (planned: patronage only, with Free's features), `pro` and `team`. Resolved on the server for every session; when several Plan Sources apply, the highest Plan wins. Library facts are free on every Plan, including `public`.
_Avoid_: tier (Tier is the Points ladder), subscription (only one way to hold a Plan)

**Plan Source**:
How a user holds their Plan: `grant` (an admin Entitlement Grant, for example for press, partners or a Team), `verified` (a Pro Verification for library staff, students and charities), `earned` (Archivist Tier or above, plus a 90-day hold after dropping below) or `paid` (reserved: there is no checkout yet). `public` and `free` have the source `none`. At equal Plan, `paid` beats `grant`, which beats `verified`, which beats `earned`. Grants and verifications live in the admin-only `entitlement-grant` and `pro-verification` collections.
_Avoid_: reason, plan type

**Collection Stat**:
A single data point describing what a Library _holds_ — volumes, manuscripts, maps, incunabula, digital objects, etc. Free-form `category` + `value` pairs today, with potential to become a structured collections API in the future.
_Avoid_: holding, asset

**Library Stat**:
A single data point describing how a Library _operates_ — annual visitors, staff count, floor area, budget, etc. Free-form `label` + `value` pairs, display-only.
_Avoid_: metric, figure, stat (alone — too generic)

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

## Relationships

- Every **Event** belongs to exactly one **Library** — even a multi-venue happening is N Events, one per Library
- A **Library** belongs to a **Country** → **Region** → optionally an **Area**
- An **Area** belongs to exactly one **Region**; not every **Region** has **Areas**
- A **Library Claim** links a user to a specific **Library** and, when approved, elevates their trust signal on future **Submissions** against that Library
- **Points** accumulate per approved **Submission** and determine a user's **Tier** and **Badge** eligibility
- A user's **Capabilities** come only from their **Contributor Role** and **Library Claims**, and their **Entitlements** only from their **Plan**. The two never feed each other; **Tier** feeds only contribution limits and earned Pro
- Every **Submission** moves through the **Submission States**; no **Plan**, **Tier** or **Contributor Role** lets it skip review
- A **Pillar Institution** is a **Library** flagged `featured: true` by editorial choice; there is no maximum per Region or Country

## Example dialogue

> **Dev:** "A user submitted a correction to the British Library's opening hours. Should that go into the moderation queue?"
> **Domain expert:** "Yes — every **Submission** goes through review. The British Library is a **Pillar Institution** but that doesn't change the flow."
>
> **Dev:** "What if the submitter has a **Library Claim** on the British Library?"
> **Domain expert:** "Their claim gives them a trusted-contributor signal, but the **Submission** still gets reviewed. The claim doesn't bypass moderation."
>
> **Dev:** "And if they get approved — do they earn **Points**?"
> **Domain expert:** "Yes. Minor edits (1–3 fields) earn 5 Points; major edits (4+ fields) earn 15. That pushes them toward the next **Tier**."

## Flagged ambiguities

- The `library` relation on the Event schema is not marked `required`, but every Event must belong to a Library — this is a schema gap to fix.
- `correction` and `library_edit` are both Submission types that change Library data. Resolved: `library_edit` is a comprehensive multi-field diff produced by the full edit wizard and requires a Library Claim; `correction` is a targeted single-issue report (category picker + freetext) available to any logged-in user with no claim required, produced by the inline correction CTA on library detail pages. Non-logged-in users see a "Sign in to suggest a correction" prompt. Library stewards (claimants) bypass corrections entirely — they use the full edit diff flow.
- `pendingReview` on Event is dead code — filtering happens at the import layer, not in Strapi. Candidate for removal.
- Library `entityRef` auto-generation is not yet implemented (lifecycle hook exists for Country/Region/Area but not Library). The current format (`GB-BL-001`) in the CLAUDE.md is a relic of manual entry; the intended scheme is hierarchically composed from parent entityRefs + the Library's short name.

- "public library" was used colloquially to mean _any library institution_ (not "open to the general public" or "publicly funded"). Resolved: **Library** covers all institutional types regardless of access model or funding source.
