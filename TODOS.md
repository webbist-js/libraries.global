# libraries.global — Open TODOs & Unfinished Work

_Last audited: 2026-05-03_

---

## CRITICAL — Broken at runtime

### 1. Stats endpoint returns 404

**File:** `apps/strapi/src/plugins/content-moderation/`
**Symptom:** `GET /api/content-moderation/submissions/stats` → 404. Route and handler are correctly written in source but the compiled plugin dist is stale.
**Fix:** Rebuild the plugin:

```bash
cd apps/strapi
pnpm build:plugins   # or: node_modules/.bin/strapi-plugin build from plugin dir
```

**Affects:** `ContributeCTA` stats bar, `LibraryHomePage` contributor/language counts.

---

## HIGH — Features wired in UI but missing backend data

### 2. MeiliSearch reindex required

**File:** `apps/strapi/config/plugins.ts`
After adding `_geo` to the library `transformEntry`, and creating the new `blog-article` and `wiki-article` indexes, all three indexes need to be rebuilt.
**Action:** Strapi admin → Settings → MeiliSearch → Rebuild each index.

- `library` — needs rebuild for `_geo` field (enables geo search / LibraryExploreNearby)
- `blog-article` — new index, won't exist until first rebuild
- `wiki-article` — new index, won't exist until first rebuild

### ~~3. "Followed users" (people) not implemented~~ ✅ DONE

Strapi `user-profile` schema now has `followedProfiles` (manyToMany self-relation). Auth-bridge routes `POST /toggle-follow-user` and `GET /user-follow-status` enforce public-only following. Next.js API route `/api/profile/me/follow-user` proxies both. `ProfileFollowButton` client component in profile hero. `FollowingPage` wired to pass `profile.followedProfiles` to `FollowingSection`.

### 4. Homepage hero: COLLECTIONS stat is not wired

**File:** `apps/ui/src/components/home/HomepageHero.tsx:40`

```ts
sub: "Items catalogued", // TODO: add when collections feature ships
```

The collections count stat slot is hardcoded. It will remain `—` until the Collections content type is built and an endpoint exists.

### ~~5. Leaderboard `rankChange` always null~~ ✅ DONE

`plugin::rewards.leaderboard-snapshot` content type added. Weekly cron (Monday 00:05 UTC) calls `snapshot.takeWeeklySnapshot()` which stores the top-1000 ranked list as JSON. `leaderboard.getLeaderboard()` now loads the previous week's snapshot via `snapshot.getPreviousWeekRankMap()` and computes `rankChange = prevRank - currentRank`. Admin `POST /rewards/snapshot` route allows manual trigger. First snapshot must be taken manually (or will auto-run next Monday) — after that, trend arrows will appear on the leaderboard.

---

## MEDIUM — Placeholder stubs / coming-soon screens

### 6. Collections tab on profile is a stub

**File:** `apps/ui/src/app/[locale]/profile/[username]/_components/sections/CollectionsSection.tsx`
Renders "Collections — coming next" placeholder. Blocked on the Collections content type being built in Strapi. All three relevant files are stubs:

- `CollectionsSection.tsx` — placeholder UI
- `collections/page.tsx` — just renders the stub
- No Strapi content type

### 7. Library detail: Events tab — not implemented

**File:** `apps/ui/src/components/library/LibraryDetailPage.tsx:243`

```tsx
{
  /* TODO: add events listing once events content type is built */
}
```

The Events feature (Events content type, provider integration, library detail tab, global `/events` browse) is planned but not started.

### 8. Library detail: IIIF Digital Collections tab — not implemented

**File:** `apps/ui/src/components/library/LibraryDetailPage.tsx:231`

```tsx
{
  /* TODO: integrate IIIF viewer when iiifEndpoint is set */
}
```

The `iiifEndpoint` field exists on the Library schema and is populated for some libraries, but there is no viewer component. IIIF viewer integration (Universal Viewer / Mirador embed) is needed.

### 9. 2FA disabled in Security settings

**File:** `apps/ui/src/app/[locale]/settings/_components/SecuritySection.tsx:82,109`
Two-factor authentication UI is commented out, waiting on Better Auth `twoFactor` plugin being installed and configured.

---

## LOW — Dead links / empty scaffolding

### ~~10. `/contribute/guide` is a dead link~~ ✅ DONE

Changed link in `ContributeCTA.tsx` to `/wiki` with label "Browse the knowledge base".

### ~~11. Empty `[city]` route directories~~ ✅ DONE

Deleted `apps/ui/src/app/[locale]/[continent]/[country]/[city]/` and its `[slug]/` subdirectory entirely.

---

## INFORMATIONAL — Not broken, but good to know

### 12. Notification prefs saved to Strapi but no emails/in-product delivery

**File:** `apps/ui/src/app/[locale]/settings/_components/NotificationsSection.tsx`
Toggle state is persisted to `user-profile.notifPrefs` in Strapi correctly. However, no email-sending infrastructure reads these prefs and sends notifications. The `weeklyDigest`, `editsReviewed`, etc. settings are UI-complete but have no delivery mechanism.

### 13. ContributionsSection uses estimated points, not actual

**File:** `apps/ui/src/app/[locale]/profile/[username]/_components/sections/ContributionsSection.tsx:93-108`
`estimatePoints()` uses hardcoded per-type values (e.g. `new_library → 50`). These values mirror the rewards plugin, but the actual awarded points from `plugin::rewards.point-event` are not fetched — if the rewards config changes, the displayed pts will diverge.

### ~~14. `/profile/settings` redirect~~ ✅ DONE

`/profile/settings` is the canonical settings page. `/settings/page.tsx` (which redirected to it) has been deleted. All `_components` moved from `settings/_components/` to `profile/settings/_components/`. All links already pointed to `/profile/settings`.

---

## Feature backlog (from CLAUDE.md Future Goals — not yet started)

| Feature                                    | Status                                         |
| ------------------------------------------ | ---------------------------------------------- |
| Events content type + provider integration | Not started                                    |
| Global `/events` browse page               | Not started                                    |
| Events on library detail page              | Not started                                    |
| Collections content type                   | Not started                                    |
| User "visit log" on library                | Not started                                    |
| Personal annotation layer                  | Not started                                    |
| Nearby libraries geo-bounding search       | Partial — MeiliSearch geo wired, needs reindex |
| Faceted search (open now, accessibility)   | Not started                                    |
| `/search` results page                     | Not started                                    |
| IIIF viewer on library detail              | Not started                                    |
| i18n expansion (FR, ES, AR, JA)            | Not started                                    |
| 2FA (Better Auth twoFactor plugin)         | Not started                                    |
