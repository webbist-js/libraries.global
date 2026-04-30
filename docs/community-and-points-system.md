# Community & Points System

The libraries.global rewards system recognises contributor effort through points, tiers, and badges. It is owned by the `rewards` Strapi v5 plugin.

---

## Point Values

| Action                 | Trigger                                                 | Points            |
| ---------------------- | ------------------------------------------------------- | ----------------- |
| `new_library_approved` | New library submission approved by editorial board      | +50               |
| `edit_accepted_major`  | Edit approved with 4 or more fields changed             | +15               |
| `wiki_translated`      | Wiki page translation approved                          | +15               |
| `photo_licensed_cc`    | CC-licensed photo accepted                              | +8                |
| `edit_accepted_minor`  | Edit approved with 1–3 fields changed                   | +5                |
| `hours_verified`       | Opening hours verified on-site                          | +5                |
| `status_verified`      | Operational status verified                             | +5                |
| `daily_streak`         | Any approved contribution on a consecutive calendar day | +1                |
| `manual_award`         | Admin manual award (reason required in metadata)        | Custom            |
| `manual_deduct`        | Admin manual deduction (reason required in metadata)    | Custom (negative) |

---

## Tier Thresholds

| Level | Name         | All-time points needed |
| ----- | ------------ | ---------------------- |
| I     | Reader       | 0                      |
| II    | Indexer      | 100                    |
| III   | Cartographer | 500                    |
| IV    | Archivist    | 1,500                  |
| V     | Scholar      | 4,000                  |
| VI    | Curator      | 9,000                  |

Tiers are computed from all-time points. The `tier` field on `user-profile` caches the current tier name so leaderboard queries do not need to recompute it on every row.

---

## Streak Mechanics

- A "streak" is the number of consecutive calendar days on which the user had an approved contribution.
- Streak is incremented when a new point event is awarded and `lastActivityDate` is yesterday.
- If `lastActivityDate` is today (a second award on the same day), streak does not increment.
- If `lastActivityDate` is any date earlier than yesterday, streak resets to 1.
- Streaks are tracked via the `streak` and `lastActivityDate` fields on `user-profile`.

---

## Badge Catalogue

| Badge ID       | Name         | Threshold                              |
| -------------- | ------------ | -------------------------------------- |
| `verifier`     | Verifier     | 10 combined hours/status verifications |
| `indexer`      | Indexer      | 10 new library submissions approved    |
| `photographer` | Photographer | 5 CC-licensed photos accepted          |
| `translator`   | Translator   | 3 wiki page translations approved      |
| `archivist`    | Archivist    | 50 edits (minor or major) approved     |
| `streaker`     | Dedicated    | 30 daily streak events in history      |

Badges are checked and awarded inside `rewards/server/services/badges.ts` after every `points.award()` call. Badge definitions live in code — not as a content type — so new badges require a code deploy.

---

## Manual Award / Deduction

Editorial staff with the `rewards:award` admin permission can manually award or deduct points via:

**Strapi admin → Rewards → Manual Award tab**

Required fields:

- **User ID (baUserId)**: the Better Auth user ID (visible in admin → User Profiles)
- **Action**: `manual_award` or `manual_deduct`
- **Points**: positive integer (sign applied automatically by action type)
- **Reason**: required text written into the event `metadata.reason` for auditability

All manual awards/deductions create a `point-event` record with `metadata.awardedBy` set to the admin's Strapi user ID.

---

## Integration with Content Moderation

Points are awarded in `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` inside `updateStatus()`, immediately after each approval side-effect (library creation, claim, etc.).

The call is wrapped in `try/catch` — a rewards failure never blocks an approval.

Action mapping:
| Submission type | Condition | Action | Points |
|-----------------|-----------|--------|--------|
| `new_library` | Approved | `new_library_approved` | 50 |
| `library_edit` | Approved, <4 fields | `edit_accepted_minor` | 5 |
| `library_edit` | Approved, 4+ fields | `edit_accepted_major` | 15 |
| `wiki_edit` | Approved, `fields.isTranslation = true` | `wiki_translated` | 15 |
| `wiki_edit` | Approved, not a translation | `edit_accepted_minor` | 5 |

---

## Security: Plugin-Only Profile Fields

The following fields on `user-profile` are written exclusively by the rewards plugin and must never appear in the `upsertProfile` allowlist in `apps/strapi/src/api/user-profile/controllers/user-profile.ts`:

- `points`
- `pointsThisMonth`
- `tier`
- `streak`
- `lastActivityDate`

These fields are read-only from the user's perspective. They are returned in public profile API responses so the frontend can display them.
