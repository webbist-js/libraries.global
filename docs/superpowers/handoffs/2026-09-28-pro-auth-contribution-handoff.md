# Handoff: finish Pro, auth and the contribution journeys

**Date:** 2026-09-28
**Repo:** `/Users/alexbennett/Development/personal/libraries.global`, branch `dev`. The work is committed locally but not pushed, and must not be pushed unless the owner asks.
**Go-live:** 15 October 2026. The frontend goes to Vercel and the backend to Strapi Cloud.
**Owner:** Alex, the only person who logs in to the Strapi admin.

This file is the single starting point. Read it fully before you touch code, then read the linked docs as each work package needs them.

---

## 1. Mission

Make three things work end to end, and prove them with tests.

1. **Auth and login work in production.** That covers email and password, magic links, Google OAuth (and GitHub if the owner wants it), email verification, password reset, onboarding, sessions and account deletion.
2. **Pro works, with payments.** Stripe through the Better Auth Stripe plugin, behind `PRO_ENABLED`, plus self-serve free-Pro verification. It sits on top of the entitlement plumbing, which is already built.
3. **The contribution journeys work end to end.** Suggest or edit, then moderate, then apply, then award points, for every role, with the needs-info reply thread.

---

## 2. Rules and hazards

Every one of these has already caused a problem in this repo.

- **Never print secrets.**
  - The shell has an **RTK hook that rewrites `grep`/`cat`/`head` and prints the matching lines**. It has leaked `.env` secrets into transcripts several times.
  - Never grep, cat or head these files: `apps/ui/.env.local`, `apps/strapi/.env`, `qa/tests/playwright/.env` or `qa/tests/playwright/TEST-USERS.local.md`.
  - To check that a key exists without printing it:
    `node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log(/^KEY=./m.test(s)?"set":"unset")' <file>`
  - `rtk proxy <cmd>` runs a command unfiltered, when you need raw output of _non-secret_ files.
- **Other agents share this working tree and git index.** The owner runs other agents at the same time.
  - Before editing any file, run `git status --short -- <file>`. If it has changes you didn't make, don't edit it. Work around it or ask.
  - **Always commit with an explicit pathspec:** `git commit -m "<msg>" -- <path> <path>`. Otherwise you'll sweep in files other agents have staged. This has already happened once.
  - Never run `git stash`, `git reset`, `git checkout -- <file>` or `git restore` on files you didn't change.
  - As of this handoff, other agents have uncommitted edits in: CONTRIBUTING.md, apps/docs/_, the app READMEs, `contribute/page.tsx`, `ContributeNavBar.tsx`, `ContributeSectionHeader.tsx`, the blog and journal components, `DocsPage.tsx`, `docs.config.ts`, `homepage.content.ts` and `legal.helpers.ts`. The `contribute/_` files overlap with work package C, so coordinate through the owner before editing them.
- **Dev servers belong to the owner.**
  - Don't start, stop or restart them. The permission system blocked an agent that tried to restart Strapi.
  - If they're down, ask the owner to run `nvm use`, then `pnpm dev:strapi` (:1337) and `pnpm dev:ui` (:3000).
  - Postgres runs in a Docker container. Meilisearch is `librariesglobal-meilisearch` on :7701. Never touch the other Meilisearch on :7700.
- **Commits:**
  - Conventional commits. The header is 72 characters or fewer, with a lower-case subject.
  - The scope is a pnpm package name (`ui`, `strapi`, `access`, `tests-playwright`), or `ci`, or `docs:` with no scope for repo docs.
  - **Never add `Co-Authored-By` or any self-credit or attribution lines.** This is the owner's global rule.
  - Work lands on `dev`, because the branch hook rejects non-`STAR-<n>` names.
  - The pre-commit hook runs eslint --fix and prettier. Errors block the commit; warnings don't. Never use `--no-verify`.
- **Environment:**
  - Node 22 (`nvm use`). A v20 shell starts, but it's wrong.
  - Strapi v5: use `strapi.documents()` for content reads and writes (see `CLAUDE.md`).
  - After changing `packages/access`, run `pnpm --filter @repo/access build`: both apps consume its `dist/`.
  - After changing Strapi plugin sources, run `pnpm --filter @repo/strapi build:plugins`. `strapi develop` doesn't reload plugin `dist`.
  - After a Strapi schema change, regenerate the types.
- **Strapi custom controllers skip `private: true`.** Never spread raw documents into public responses. Use the `publicProfile()` helper in `apps/strapi/src/api/user-profile/controllers/user-profile.ts`, or an explicit allowlist.
- **Better Auth rate-limits sign-ins to 5 per minute per IP**, with database storage. Budget sign-ins in E2E tests.

---

## 3. Principles that bind every change

These come from the Pro design spec and the access spec §3.

1. **Library facts are free, always.** Contributing is free, and is never paywalled.
2. **Three axes never mix.**
   - **Contributor Role** plus Library Claims give **Capabilities**.
   - **Tier**, from points, gives limits only.
   - **Plan** gives **Entitlements**.
   - Type-level invariant tests in `packages/access/tests/invariants.test-d.ts` enforce this. Keep them green.
3. **Money never buys trust.** No plan changes a role, points, tier, badges or moderation. The E2E asserts that Pro fixtures have exactly the reader's capabilities.
4. **Gate on the server, and fail closed.** UI locks are for explanation only. Strapi's `submission-policy` is authoritative for contributions. Next route checks are fast pre-checks.
5. **Show locked or unbuilt things honestly.** Label them "Coming soon"; never show fake data. The design is the v2 warm-paper design system, with the accessibility baseline in `CLAUDE.md` (WCAG A as a minimum; status shown as colour plus icon plus text).

---

## 4. State of play: what's built

### Done and reviewed (on `dev`)

**P-A: security hardening.** Items A1–A13, commits `3c14dc8..377b18c`. It covers:

- the moderation state machine and compare-and-set approvals
- idempotent points with DB unique indexes
- the draft-status strip middleware
- privacy gates, and the upload token

Plan: `docs/superpowers/plans/2026-09-26-pa-hardening.md`. Regression notes: `qa/tests/security/pa-regressions.md`.

**P-B: session access.** Commits `475c373..b7623b4`. It covers:

- `@repo/access` (capabilities, limits, entitlements)
- the Strapi `session-profile` bridge
- the session fields (`capabilities`, `claimedLibraryIds`, `plan`, `planSource`, `features`, `limits`, `profileLoaded`), with a per-user cache: 60 s, a generation guard and in-flight dedupe
- `requireCapability`/`requireEntitlement`, and `useCapabilities`/`useEntitlements`
- the role-matrix E2E

Plan: `docs/superpowers/plans/2026-09-26-pb-access-session.md`.

**P-D0: Pro via grants, the pricing page, and fixtures.** Plan: `docs/superpowers/plans/2026-09-27-pd0-pro-grants-pricing.md`. Its commits, in order:

`1a923da 9a935e3 10a0247 36eb844 07e5c73 462171c 3552001 afb6979 8c20898 fe8960d 384c536 488acbe 80448ce 59164e8 aee59d7 92782d7 2f83edb 6254f45 6dd4fb2 1683924 b29d503 c509287 2ea9bdb 0db3ada 3d7fca3 2876308 fd92d93`

Other agents' commits are interleaved: `edf96ea c2a439a c63dfaf f98eac7 f42cdb4 36421fe`.

- **Admin-only Strapi collections** `entitlement-grant` and `pro-verification`, plus `user-profile.earnedProUntil`. Earned Pro means Archivist tier or above (1,500 points), with a 90-day hold after dropping below.
- **The bridge** returns grants, verifications and `earnedProUntil`. The session resolves the real plan: `planSource` is grant, earned or verified, and `paid` is reserved.
- **The `/pro` page** (`apps/ui/src/app/[locale]/pro/page.tsx`).
  - Plan copy and **placeholder** prices are in `apps/ui/src/lib/plans.ts`: Supporter £3/£30, Pro at a founding £5/£50 rising to £8/£80, Team £480/year ex VAT.
  - It's linked from the account menu, the Atlas plans sheet and the CMS footer.
- **The first live Pro feature, Atlas export (CSV and GeoJSON).**
  - `POST /api/export/atlas` does `requireEntitlement("atlas.export")` and enforces a row cap from `limits.exportRows`: free 0, pro 10,000, team 50,000.
  - It validates documentId-shaped ids, counts body bytes as they're read, calls the Strapi bridge in chunks of 5,000 ids, validates the rows with zod, and streams the response. CSV starts with a BOM and escapes formula injection.
  - The data comes from the Strapi action `POST /api/libraries/export`, gated by `X-Service-Secret`.
  - The UI is `AtlasExportButton`.
- **Auth forms can't leak secrets into URLs before hydration.** They use `method="post"`, and submit is disabled until hydrated, via `hooks/useMounted` with `useSyncExternalStore`.
- **The onboarding fields have accessible names** (`htmlFor`/`id`, groups, `aria-live` status).
- **Ten local fixtures, with E2E for plans, export and onboarding.** 16 tests, all passing.
- **Docs:** the `plans-and-pro` wiki article, plus updates to CONTEXT.md, CLAUDE.md and TODOS.md.

**Not yet done for P-D0: the final whole-branch review.** Do this first (§6, WP0).

### Test accounts

- The accounts are in **`qa/tests/playwright/TEST-USERS.local.md`**. It's git-ignored and holds the password, so the owner reads it; you don't print it.
- There are 10 fixtures, all `access-<key>@example.test`: reader, contributor, librarian (claims Loddon Library), wiki-editor, editorial, onboarding (username reset on every seed), pro-grant, pro-earned, pro-verified and team.
- Seed or reset them with `cd qa/tests/playwright && pnpm seed:access`. It doesn't work from the repo root, and it's local-only with guards.
- The seed writes through a headless Strapi (`helpers/strapi-access-writer.cjs`), because Strapi REST can't write profiles or affiliations.
- The password is `ACCESS_FIXTURE_PASSWORD`, in `qa/tests/playwright/.env`.

---

## 5. How to verify

```bash
nvm use
cd packages/access && pnpm test              # vitest + type-level invariants
cd apps/strapi && npx vitest run && npx tsc --noEmit -p .
cd apps/ui && npx vitest run && npx tsc --noEmit             # rm -rf .next/types if stale route types error
pnpm test:ci                                  # what CI runs (from repo root)
cd qa/tests/playwright && pnpm seed:access && npx playwright test --project=access   # 16 E2E, ~3 min (needs both dev servers)
# All of the above passed at handoff (2026-09-28).
```

The `access` Playwright project is opt-in. It only exists with `--project=access`, and has `workers: 1` and `trace: off`, because traces would record the fixture password.

---

## 6. Work packages, in priority order

Use `superpowers:writing-plans`, then `superpowers:subagent-driven-development`, as the earlier phases did.

- Save plans to `docs/superpowers/plans/`.
- Keep a task ledger in `.git/sdd/progress.md`, appending a new section. The file already holds the earlier phases' notes and deferred minors.
- Review each task: spec compliance, then quality.
- Do one whole-branch review per phase.
- Give implementers compact briefs, and tell them to keep tool calls short. Agents with very large contexts stalled twice.

### WP0: close out P-D0 (small)

- Run a whole-branch review of the P-D0 commits listed in §4. Exclude the other agents' commits, and the lockfile if it's noisy.
- Triage the recorded minors in `.git/sdd/progress.md`, under the "PD0 Task N" lines:
  - The Atlas export lock doesn't use `ProChip`, unlike `AtlasLayersTab`.
  - The documentId regex is duplicated between the UI and Strapi; it could live in `@repo/access`.
  - The export bridge fetch has no timeout, and a non-2xx response body isn't cancelled.
  - The `useMounted` doc comment is inaccurate.
  - No test pins the new onboarding `aria-label`s.
  - The Public card in `/pro` shows "No account needed" to signed-in users.
- Before go-live, try one large export on a Vercel preview. Function responses are limited to 4.5 MB, and the route streams.

### WP1: auth and login, production-ready

Code is in `apps/ui/src/lib/auth.ts`, `apps/ui/src/app/[locale]/auth/*`, `profile/onboarding/*` and `apps/strapi/src/api/auth-bridge/*`. Specs: `docs/superpowers/specs/2026-04-25-better-auth-migration-design.md` and `2026-04-26-settings-onboarding-design.md`.

1. **Magic-link sign-in skips onboarding.** `SignInForm.tsx:93-96` passes `callbackURL: callbackUrl` instead of routing through `/auth/post-signin`. A user who never onboarded and uses a magic link never reaches onboarding. Route it through `/auth/post-signin?callbackUrl=...`, with a safe-redirect check (`lib/safe-redirect`).
   - Add an E2E. Magic-link tokens are stored in the Better Auth `verification` table, so a test can request a link, read the token from the local DB and visit the link. Email-verification tokens are signed JWTs, not DB rows, which is why the seed flips `emailVerified` directly.
2. **Email delivery.** `apps/ui/src/lib/email.ts` supports Mailtrap (`MAILTRAP_*`) and Mailgun (`MAILGUN_SMTP_*`). In production it throws if neither is set.
   - Get Mailtrap sandbox credentials from the owner, and verify each email end to end: the verification, password reset and magic link.
   - Document the production env vars in `docs/pre-golive-checklist.md`.
3. **OAuth.**
   - Only **Google** is wired (`auth.ts` `socialProviders`). GitHub credentials exist in env, but GitHub isn't configured, although `CLAUDE.md` claims it is. Ask the owner whether GitHub is wanted, and either wire it or fix the docs.
   - Verify the redirect URIs for local and production. `baseURL` and `trustedOrigins` come from `APP_PUBLIC_URL`.
   - Keep the pre-hijack guard in `databaseHooks.account.create`, and the terms-version carry-through in the OAuth state.
   - Write a manual test checklist, since E2E can't do real OAuth.
4. **Terms and 18+ consent** (`lib/legal-consent.ts`, `TERMS_VERSION`) were added by another agent. Add E2E coverage: registering through the UI requires the checkbox, and a sign-up without the current `termsVersion` is refused.
5. **Sessions.**
   - Do the manual two-browser revoke check: settings → sessions, revoke the other device, and it's signed out.
   - Confirm that a revoked role takes effect within 60 s. That's the bridge cache TTL, and the only invalidation is on `/api/profile/me` writes.
6. **Account deletion and retention** (another agent's work: `apps/strapi/src/utils/erase-account.ts` and the `api/cron/retention` route). Once WP2 lands, deletion must also cancel the subscription and delete the Stripe customer.
7. **Accessibility gaps left over:**
   - `profile/settings/_components/PublicProfileSection.tsx` has about 14 labels with no `htmlFor`, which fails WCAG A in the same way onboarding did.
   - The avatar upload button is named by the user's initials.
   - The combobox triggers lack `aria-expanded`/`aria-haspopup`.
8. **The E2E funnel:** register through the UI (terms checkbox) → flip `emailVerified` through the local DB (as the seed does) → sign in → onboarding → profile. The pieces exist in `qa/tests/playwright/e2e/access/`.

### WP2: Pro with payments (spec phase P-D1, behind `PRO_ENABLED`)

Specs:

- `docs/superpowers/specs/2026-09-26-access-contribution-pro-implementation-design.md`:
  - §6: the screen inventory, Stripe, the payment state, return-to-context, C5 and C6
  - §7: the server enforcement map
  - §9: testing
  - §10.2: the decisions
- `docs/superpowers/specs/2026-09-26-pro-subscriptions-design.md`: billing and webhooks.
- `docs/superpowers/specs/2026-09-27-pricing-and-membership.md`: the pricing proposal. **The prices are placeholders until the owner confirms them.**

**The design:** the checkout and Pro screens are frames C1–C6, CM1–CM2, M1–M5, 08 and 09 of the **"Atlas Explorer" design in claude.ai/design (`Atlas Explorer.html`)**. It isn't in the repo, so **ask the owner to share it** before building the checkout UI.

1. **Setup.**
   - Add `@better-auth/stripe` (Better Auth is 1.4.18) and a `PRO_ENABLED` flag, off by default. The paid CTAs stay "Coming soon" while it's off.
   - The owner must provide Stripe **test** keys (secret, publishable, webhook secret) and Price IDs.
   - Decide spike S1 / D-P1: Embedded Checkout versus the Payment Element.
2. **Plans.**
   - Add a `supporter` plan key to `@repo/access` `PlanKey`: free features and limits plus a `supporterMark` (pricing spec).
   - Pro monthly and annual.
   - Team through an enquiry (C6), fulfilled by staff with Stripe Invoicing plus `team` grants. `entitlement-grant.source` already has `team`.
   - Price IDs come from a server allowlist. `lib/plans.ts` display amounts must come from, or be checked against, Stripe prices. Nothing in feature code hard-codes an amount.
3. **Entitlements.**
   - Feed the Better Auth `subscription` row into `resolveEntitlements` in `apps/ui/src/lib/session-access.ts` (`buildSessionAccess`).
   - The resolver already implements the status rules: active and trialing are entitled; past_due has a 7-day grace period; canceled is entitled until period end.
   - Keep the invariants green.
   - Invalidate the session cache on subscription changes.
4. **Webhooks.**
   - The plugin's handler lives at `/api/auth/stripe/webhook` and verifies the signature.
   - Add a Strapi mirror: a `POST /api/auth-bridge/sync-plan` route, secret-gated with allowlisted fields, writing plan fields on the user-profile for cron and admin visibility.
   - Upserts must be idempotent, keyed by the subscription id.
   - Add a nightly reconcile job.
5. **UI.**
   - The checkout sheet (C1–C4) with URL state. It's full-screen on mobile (CM1–CM2).
   - A payment state machine, including a Bacs "pending" state, and the Done screen.
   - Return to where the user started.
   - A Plan & billing section in settings: plan, source, renewal, change, cancel or resume, and the Customer Portal.
   - Honest cancellation copy.
6. **C5 self-serve free Pro** (§6.5). This covers verified library staff, students and charities, and creates `pro-verification` rows, which already exist and are admin-created today.
   - Email-domain verification with a 32-byte token, stored hashed, single-use and expiring. Renewed yearly.
7. **Account deletion and export.** Deletion cancels the subscription and deletes the Stripe customer, and the data export includes plan history.
8. **Tests** (§9):
   - `stripe listen` against local.
   - Cards: `4242…` succeeds, `4000 0000 0000 0002` is declined (the C3 screen), and `4000 0027 6000 3184` triggers 3DS.
   - Webhook fixtures for created, updated, past_due, canceled, deleted and processing.
   - A reconcile test.
   - Add paid rows to the access E2E.
9. **VAT and legal.**
   - Don't open consumer checkout outside the UK without Stripe Tax: EU VAT on digital services applies from the first sale.
   - UK VAT registration is only compulsory above £90k turnover.
   - Honour the 14-day cancellation right.
   - The owner must confirm with an accountant (D-P2).
10. **Later phases, which need data:** per-capita and deprivation layers (P-D2), and Reach and draw-to-analyse (P-D3). Keep them "Coming soon".

### WP3: the contribution journeys (spec phase P-C: "the full end-to-end workflow")

Spec: the access spec §5 (C-L, C-D, C-J, C-M) and §8, personalisation. The backlog is in `TODOS.md`, under "Deferred to P-C". Other agents are editing parts of `contribute/*` right now, so check with the owner first.

1. **I6, the docs block editor** (the first item).
   - `apps/ui/src/app/api/contribute/wiki/[slug]/route.ts:83-89` (PATCH) and `finalize/route.ts:22-28` require an integer `submissionId`, but Strapi uses documentId strings.
   - `WikiBlockEditor` doesn't send `asDraft: true`.
   - A draft is never resumed. The GET route exists, but nothing calls it.
2. **C-L1: approval must apply the change.** Today, approving `library_edit` or `correction` awards points and **writes nothing**.
   - Add `applyLibraryEdit` and `applyCorrection` in `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`, with the field allowlist, a revision entry and publish.
   - Award points only after a real apply.
   - A free-text correction gets "applied manually".
3. **C-L2: broken links.**
   - `RecordsThatNeedYou.tsx:125`, `TasksSection.tsx:152` and `HubActionChooser.tsx:174` always go to `/edit`. They should route by `canSubmit` for claimants versus non-claimants.
   - `LibraryDetailPage.tsx:278` links to `/contribute/event-feed`; the correct path is `/contribute/events`.
   - `RolesTable.tsx:149` and `events/page.tsx:157` link to the claim page with no parameters.
4. **C-L3:** the photo and source flows, as `correction` subtypes.
5. **The docs flows:**
   - C-D2: a `/contribute/docs` hub, and a Docs tab.
   - C-D3: an editor diff and preview step.
   - C-D4: approving `new_doc` creates a _draft_ wiki-article. Today there's no `new_doc` type in the schema enum.
6. **C-J1:** a journal pitch form at `/contribute/journal`. Approving a `blog_submission` should create a draft blog-article, but today approving it does nothing.
7. **C-M1 and C-M2** (spec §5.3a):
   - Make `needs_info` submissions editable by the submitter (resubmitting moves `needs_info → pending`).
   - Add a `submission-message` thread between submitter and moderators, with an admin composer, and a `/contribute/submissions/[id]` page.
   - There's **no notification plumbing yet**. Ask the owner: in-app only, or email as well.
8. **§5.4, the adaptive hub.** Drive it with `useCapabilities()`, which currently has no call sites. Rewrite `RolesTable` for the real model: remove "publish without review" and "review others' changes". Build on the other agent's role-based shortcuts (`f42cdb4`).
9. **§8, personalisation:**
   - A Join button in the navbar.
   - Account menu links: Saved, Following, and My submissions for everyone, not just verified librarians.
   - A `WelcomeBackWidget`, and a `QuickWinsSection` on top of the existing `api/contribute/quick-wins` backend.
   - A signed-out prompt on `SaveEventButton`.
   - Recently viewed items, in localStorage.
10. **Hardening deferred from P-B** (in `TODOS.md`):
    - `/api/upload` is gated only in Next, and has no `uploadsPerDay` enforcement.
    - `hasCapability` needs a per-library scope.
    - The event-feed route should use the `events.feed` capability.
    - `topContributors` is cut to 10 before hidden profiles are filtered out.
11. **E2E per role for the journeys.** To test moderation for real, create a local Strapi admin fixture (through the headless writer, local-only), log in through `/admin/login`, and call the moderation admin routes. Don't bypass the state machine through MCP or content-manager writes.

---

## 7. Decisions still open for the owner

Ask; don't assume.

- **Pricing.** Confirm or change the placeholder prices, VAT registration and legal structure (CIC, charity or sole trader), and payment methods (D-P3).
- **Stripe checkout UI** (D-P1).
- **The licence line** "Records are CC BY-SA" (D-P6), which needs a licence check against the imported sources.
- **The followed-library digest:** a free weekly digest with Pro instant alerts? (D-P7)
- **GitHub OAuth:** wire it, or remove it from the docs.
- **The needs-info thread notifications:** in-app only, or email too.
- **`apps/docs`** is the stale Docusaurus starter site. Keep it or delete it? Another agent is editing it.
- **The spec decisions** D-C1–6, D-P1–8 and D-O1–4 (access spec §10.2), and D-O4, whether the repo is public.

**Manual checks still owed:**

- admin role permissions: Super Admin versus a restricted role
- the two-browser session revoke
- the preview-mode draft render
- live re-runs of A2, A3, A4 and A11 (see `qa/tests/security/pa-regressions.md`)

---

## 8. Document map

| What                                                                            | Path                                                                                                                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Project context, conventions, **Access model** and **Testing access**           | `CLAUDE.md`                                                                                                                    |
| Domain glossary (Capability, Entitlement, Plan, Plan source, Submission states) | `CONTEXT.md`                                                                                                                   |
| Backlog, including "Deferred to P-C"                                            | `TODOS.md`                                                                                                                     |
| Go-live checklist                                                               | `docs/pre-golive-checklist.md`                                                                                                 |
| **Master spec:** access, contribution and Pro, with phases and decisions        | `docs/superpowers/specs/2026-09-26-access-contribution-pro-implementation-design.md`                                           |
| Pro principles, billing and webhooks                                            | `docs/superpowers/specs/2026-09-26-pro-subscriptions-design.md`                                                                |
| Pricing proposal                                                                | `docs/superpowers/specs/2026-09-27-pricing-and-membership.md`                                                                  |
| Better Auth migration and onboarding design                                     | `docs/superpowers/specs/2026-04-25-better-auth-migration-design.md`, `2026-04-26-settings-onboarding-design.md`                |
| Wiki contribution and rewards designs                                           | `docs/superpowers/specs/2026-04-30-wiki-contribution-design.md`, `2026-04-30-community-rewards-design.md`                      |
| Completed plans, as pattern references                                          | `docs/superpowers/plans/2026-09-26-pa-hardening.md`, `2026-09-26-pb-access-session.md`, `2026-09-27-pd0-pro-grants-pricing.md` |
| Security regression notes                                                       | `qa/tests/security/pa-regressions.md`                                                                                          |
| Task ledger, with deferred minors per task (local, in `.git`)                   | `.git/sdd/progress.md`                                                                                                         |
| Test accounts (git-ignored; the owner reads it)                                 | `qa/tests/playwright/TEST-USERS.local.md`                                                                                      |
| Checkout and Pro screen designs                                                 | claude.ai/design, "Atlas Explorer" (`Atlas Explorer.html`); ask the owner                                                      |

### Key code

- `packages/access/src/{capabilities,limits,roles,entitlements}.ts`: pure access rules.
- `apps/ui/src/lib/`:
  - `auth.ts`: Better Auth config and `customSession`
  - `session-profile.ts`: the bridge fetch, 60 s cache, generation guard and dedupe
  - `session-access.ts`: session fields, via `resolveCapabilities` and `resolveEntitlements`
  - `access-server.ts`: `requireCapability` and `requireEntitlement`
  - `access-client.ts`: the hooks
  - `plans.ts`: plan copy and placeholder prices
  - `export-format.ts` and `library-export-bridge.ts`: the Pro export
  - `bridge-params.ts`: documentId rules and `readJsonCapped`
  - `email.ts`
  - `legal-consent.ts`
- `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`: `sessionProfile`, `syncUser`, account deletion.
- `apps/strapi/src/api/{entitlement-grant,pro-verification}/`: the admin-only collections.
- `apps/strapi/src/api/library/{controllers,routes}/library-export.ts` and `src/utils/library-export.ts`: the export bridge.
- `apps/strapi/src/plugins/content-moderation/server/services/{submission.ts,submission-policy.ts}` and `utils/transitions.ts`.
- `apps/strapi/src/plugins/rewards/server/services/points.ts`: tiers and the earned-Pro hold.
- `qa/tests/playwright/helpers/{access-fixtures.ts,seed-access-fixtures.ts,strapi-access-writer.cjs}` and `e2e/access/*`.
