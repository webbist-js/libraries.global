# Events Admin Dashboard — Design Spec

**Date:** 2026-05-03
**Scope:** Strapi plugin admin UI for the `events` plugin only. Frontend events page is a separate spec.

---

## Goal

Add an admin dashboard to the existing `plugin::events` Strapi plugin so editors can manage event source credentials, monitor import runs, review flagged events, and check sync worker health. The backend API (controllers, routes, services) was built in Phase 1 and is complete.

---

## Architecture

Follows the exact pattern used by `plugin::content-moderation` and `plugin::rewards`.

### New files

```
apps/strapi/src/plugins/events/
├── strapi-admin.tsx                          — register menu link + lazy-load App
└── admin/src/
    ├── index.ts                              — export { App }
    ├── pages/
    │   └── EventsDashboard.tsx               — root page; renders 4 tabs
    └── components/
        ├── CredentialList.tsx                — credentials tab content
        ├── CredentialForm.tsx                — create/edit modal form
        ├── ImportRunList.tsx                 — import runs tab content
        ├── ImportRunDetail.tsx               — expandable run row detail panel
        ├── PendingReviewList.tsx             — pending review tab content
        └── WorkerHealth.tsx                  — worker health tab content
```

### Changes to existing files

- `strapi-server.ts` — add `pluginId: "events"` to `register()` so admin routes resolve correctly.
- `server/routes/admin.ts` — add `isAuthenticated` policy to all admin routes (currently unprotected).

### Tech

- **Data fetching:** `useFetchClient()` from `@strapi/strapi/admin` for all API calls.
- **UI components:** `@strapi/design-system` — `Tabs`, `Button`, `Typography`, `Box`, `Flex`, `Modal`. Custom inline styles (matching existing plugin style) for everything else.
- **No new dependencies.**

---

## Registration (`strapi-admin.tsx`)

Identical pattern to rewards/content-moderation:

```ts
export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/events`,
      icon: CalendarIcon, // inline SVG, no peer dep
      intlLabel: { id: "events.plugin.name", defaultMessage: "Events" },
      Component: async () => {
        const { App } = await import("./admin/src/index")
        return App
      },
    })
  },
  bootstrap() {},
}
```

---

## Tab layout (`EventsDashboard.tsx`)

Four tabs using `@strapi/design-system` `<Tabs.Root>`:

| Tab            | Badge                                              | Content component   |
| -------------- | -------------------------------------------------- | ------------------- |
| Credentials    | —                                                  | `CredentialList`    |
| Import Runs    | —                                                  | `ImportRunList`     |
| Pending Review | Count from `GET /admin/pending-review`             | `PendingReviewList` |
| Worker         | Coloured dot (green = idle/running, red = offline) | `WorkerHealth`      |

---

## Tab 1 — Credentials (`CredentialList` + `CredentialForm`)

### List view

Card grid (`repeat(auto-fill, minmax(280px, 1fr))`). Each card shows:

- Label (bold)
- Provider badge (colour-coded: Eventbrite = purple, iCal = green, Meetup = orange, etc.)
- Scope (Library / Group)
- Linked library names + entity refs (or "N libraries linked" for group scope)
- Last sync time + event count, or error message
- Left border: green = ok, red = error

Card actions: **Edit** (opens modal), **Test** (inline), **Delete** (confirm dialog).

"+ Add Credential" button in section header, and a dashed "add" card at end of grid — both open the same modal.

### Create/Edit modal (`CredentialForm`)

A `@strapi/design-system` `<Modal>` (full-page overlay, 520px wide).

Fields:

| Field             | Type                            | Notes                                                                                                                |
| ----------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Label             | Text input                      | Required                                                                                                             |
| Provider          | Select                          | 7 options (see below)                                                                                                |
| Scope             | Radio                           | Library / Group                                                                                                      |
| Libraries         | Search-as-you-type multi-select | Queries `/api/libraries?filters[name][$containsi]=...`. Shows name + entity ref as tag pills. Library scope = max 1. |
| Credential fields | Dynamic section                 | Changes per provider (see below)                                                                                     |
| Active            | Checkbox                        | Default: checked                                                                                                     |

**Dynamic credential fields per provider:**

| Provider               | Fields                              |
| ---------------------- | ----------------------------------- |
| `eventbrite`           | API Key (password), Organisation ID |
| `ical` / `custom_ical` | Feed URL                            |
| `meetup`               | API Key (password)                  |
| `google_events`        | API Key (password), Calendar ID     |
| `facebook_events`      | Access Token (password), Page ID    |
| `librarycloud`         | API Key (password)                  |

On save: serialise dynamic fields to `{ fieldName: value }` JSON, send as `credentialsEncrypted` to `POST /admin/credentials` (create) or `PUT /admin/credentials/:documentId` (edit).

Modal footer actions: **Cancel**, **Test Connection**, **Save Credential**.

Test Connection behaviour: on an existing credential, calls `POST /admin/credentials/:documentId/test`. On a new (unsaved) credential, calls a new backend endpoint `POST /admin/credentials/test-raw` which accepts `{ provider, credentials }` as plaintext JSON (no encryption), proxies to the sync worker's `/test-credential`, and returns the result. No save required before testing. Result shown as inline success/error text in the modal footer.

> **Backend note:** `POST /admin/credentials/test-raw` must be added to `server/routes/admin.ts` and `server/controllers/admin.ts` as part of this phase.

---

## Tab 2 — Import Runs (`ImportRunList` + `ImportRunDetail`)

### List

Table (newest first). Columns: Run ID (truncated monospace), Triggered by, Started, Duration, Status badge, Created (+N green), Updated, Errors.

Clicking a row toggles an inline `ImportRunDetail` panel below it.

**Status badges:** Success (green), Partial (orange), Failed (red), Running (blue + spinner).

**Trigger Sync** button in section header — calls `POST /admin/sync`, shows loading state, then auto-refreshes the list after 2 seconds.

Auto-refreshes every 30 seconds if any run has `status: "running"`.

### Detail panel (`ImportRunDetail`)

Two-column grid:

- **Left — Event Stats:** Fetched, Created, Updated, Unchanged, Expired purged, Pending review
- **Right — Provider Breakdown:** One row per provider showing fetched count and new events

Failed credentials listed below the grid if `failedCredentials.length > 0`.

---

## Tab 3 — Pending Review (`PendingReviewList`)

Table of events where the venue matcher returned `result: "review"`. Columns: Event title + provider label, Venue name (from provider), Matched library name + entity ref, Confidence badge, Event date, Actions.

Row actions (inline buttons, no modal):

- **Approve** — calls `PATCH /admin/pending-review/:documentId` with `{ action: "approve" }`. Row fades out on success.
- **Discard** — calls `PATCH /admin/pending-review/:documentId` with `{ action: "discard" }`. Row fades out on success.

Empty state when queue is clear: checkmark icon + "Queue is clear — no events pending review."

Tab badge shows the count, fetched on mount alongside the pending review list.

---

## Tab 4 — Worker Health (`WorkerHealth`)

Single card fetched from `GET /admin/worker-health` (which proxies to the sync worker's `GET /health` endpoint).

Displays:

- Status indicator dot + label (Idle / Running / Offline)
- Last sync: run ID + timestamp + outcome
- Next scheduled sync (derived from cron expression in response)
- Worker version

**Offline state:** Red dot, "Worker offline — check `WORKER_URL` environment variable" error message.

No actions in this tab. Trigger Sync lives in the Import Runs tab to keep them co-located with run history.

---

## API surface used

All routes under `/events/` prefix (Strapi plugin route prefix):

| Method | Path                                         | Used by                                           |
| ------ | -------------------------------------------- | ------------------------------------------------- |
| GET    | `/events/admin/credentials`                  | CredentialList                                    |
| POST   | `/events/admin/credentials`                  | CredentialForm (create)                           |
| PUT    | `/events/admin/credentials/:documentId`      | CredentialForm (edit)                             |
| DELETE | `/events/admin/credentials/:documentId`      | CredentialList (delete)                           |
| POST   | `/events/admin/credentials/:documentId/test` | CredentialForm (existing) + CredentialList        |
| POST   | `/events/admin/credentials/test-raw`         | CredentialForm (unsaved) — **new route, Phase 2** |
| GET    | `/events/admin/runs`                         | ImportRunList                                     |
| GET    | `/events/admin/runs/:runId`                  | ImportRunDetail                                   |
| POST   | `/events/admin/sync`                         | ImportRunList (trigger)                           |
| GET    | `/events/admin/worker-health`                | WorkerHealth                                      |
| GET    | `/events/admin/pending-review`               | PendingReviewList                                 |
| PATCH  | `/events/admin/pending-review/:documentId`   | PendingReviewList (approve/discard)               |

Plus `/api/libraries` (Strapi content API) for the library search-as-you-type in CredentialForm.

---

## Error handling

- All `useFetchClient()` calls wrapped in try/catch.
- API errors shown as inline error messages below the relevant section (not toast-only).
- Loading spinners on all async actions.
- Credential delete shows a browser `confirm()` dialog before firing.
- Test connection result shown as inline success/error text below the Test button.

---

## Out of scope

- Browsing or searching all events (no admin route for this — use Strapi content manager).
- Event detail editing (handled by sync worker + pending review flow).
- User permission levels beyond "is authenticated" (all authenticated Strapi admin users can use this panel).
