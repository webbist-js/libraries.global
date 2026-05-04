# Events Admin Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Strapi admin dashboard to the existing `plugin::events` plugin so editors can manage event source credentials, view import runs, review flagged events, and check sync worker health.

**Architecture:** Follows the exact pattern used by `plugin::content-moderation` and `plugin::rewards` — a `strapi-admin.tsx` entry point registers a menu link and lazy-loads an `App` component from `admin/src/`, which renders a tab-based dashboard. All API calls use `useFetchClient()` from `@strapi/strapi/admin`. One new backend endpoint (`test-raw`) is added to support testing unsaved credentials.

**Tech Stack:** React, `@strapi/design-system` (Tabs, Button, Box, Flex, Typography), `@strapi/strapi/admin` (useFetchClient), inline styles matching the existing plugin pattern. No new dependencies.

---

## File Map

### New files (create)

| File                                                                        | Purpose                                                               |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/strapi/src/plugins/events/strapi-admin.tsx`                           | Register menu link + lazy-load App component                          |
| `apps/strapi/src/plugins/events/admin/src/index.ts`                         | Export `EventsDashboard` as `App`                                     |
| `apps/strapi/src/plugins/events/admin/src/pages/EventsDashboard.tsx`        | Root page — 4 tabs (Credentials, Import Runs, Pending Review, Worker) |
| `apps/strapi/src/plugins/events/admin/src/components/CredentialList.tsx`    | Credentials tab — card grid + delete/test                             |
| `apps/strapi/src/plugins/events/admin/src/components/CredentialForm.tsx`    | Create/edit modal — dynamic per-provider fields + library search      |
| `apps/strapi/src/plugins/events/admin/src/components/ImportRunList.tsx`     | Import runs tab — table + trigger sync + auto-refresh                 |
| `apps/strapi/src/plugins/events/admin/src/components/ImportRunDetail.tsx`   | Expandable row detail panel for a run                                 |
| `apps/strapi/src/plugins/events/admin/src/components/PendingReviewList.tsx` | Pending review tab — approve/discard table                            |
| `apps/strapi/src/plugins/events/admin/src/components/WorkerHealth.tsx`      | Worker health tab — status card                                       |

### Modified files

| File                                                         | Change                                          |
| ------------------------------------------------------------ | ----------------------------------------------- |
| `apps/strapi/src/plugins/events/strapi-server.ts`            | Add `pluginId: "events"` to the exported object |
| `apps/strapi/src/plugins/events/server/routes/admin.ts`      | Add `POST /admin/credentials/test-raw` route    |
| `apps/strapi/src/plugins/events/server/controllers/admin.ts` | Add `testRaw` handler                           |

---

## Task 1: Backend — pluginId + test-raw endpoint

**Files:**

- Modify: `apps/strapi/src/plugins/events/strapi-server.ts`
- Modify: `apps/strapi/src/plugins/events/server/routes/admin.ts`
- Modify: `apps/strapi/src/plugins/events/server/controllers/admin.ts`

- [ ] **Step 1: Add `pluginId` to strapi-server.ts**

Current file at `apps/strapi/src/plugins/events/strapi-server.ts`:

```typescript
import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"

export default {
  register() {},
  bootstrap() {},
  config: { default: {}, validator() {} },
  contentTypes,
  controllers,
  middlewares: {},
  policies: {},
  routes,
  services,
}
```

Replace with:

```typescript
import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"

export default {
  pluginId: "events",
  register() {},
  bootstrap() {},
  config: { default: {}, validator() {} },
  contentTypes,
  controllers,
  middlewares: {},
  policies: {},
  routes,
  services,
}
```

- [ ] **Step 2: Add test-raw route to admin.ts**

At `apps/strapi/src/plugins/events/server/routes/admin.ts`, add one route after the existing `test` route (after line 33):

```typescript
  {
    method: "POST",
    path: "/admin/credentials/test-raw",
    handler: "admin.testRaw",
    config: ADMIN_AUTH,
  },
```

The full file after the change:

```typescript
const ADMIN_AUTH = { policies: ["admin::isAuthenticatedAdmin"] }

export default [
  {
    method: "GET",
    path: "/admin/credentials",
    handler: "admin.listCredentials",
    config: ADMIN_AUTH,
  },
  {
    method: "POST",
    path: "/admin/credentials",
    handler: "admin.createCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "PUT",
    path: "/admin/credentials/:documentId",
    handler: "admin.updateCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "DELETE",
    path: "/admin/credentials/:documentId",
    handler: "admin.deleteCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "POST",
    path: "/admin/credentials/:documentId/test",
    handler: "admin.testCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "POST",
    path: "/admin/credentials/test-raw",
    handler: "admin.testRaw",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/runs",
    handler: "admin.listRuns",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/runs/:runId",
    handler: "admin.getRun",
    config: ADMIN_AUTH,
  },
  {
    method: "POST",
    path: "/admin/sync",
    handler: "admin.triggerSync",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/worker-health",
    handler: "admin.workerHealth",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/pending-review",
    handler: "admin.listPendingReview",
    config: ADMIN_AUTH,
  },
  {
    method: "PATCH",
    path: "/admin/pending-review/:documentId",
    handler: "admin.reviewEvent",
    config: ADMIN_AUTH,
  },
]
```

- [ ] **Step 3: Add testRaw handler to controllers/admin.ts**

At `apps/strapi/src/plugins/events/server/controllers/admin.ts`, add the `testRaw` method after the existing `testCredential` method (after the closing brace of `testCredential`, before `listRuns`):

```typescript
  async testRaw(ctx: any) {
    const { provider, credentials } = ctx.request.body as {
      provider: string
      credentials: Record<string, string>
    }
    if (!provider || !credentials) {
      ctx.status = 400
      ctx.body = { ok: false, error: "provider and credentials are required" }
      return
    }
    const workerUrl = process.env.WORKER_URL ?? "http://localhost:3100"
    try {
      const res = await fetch(`${workerUrl}/test-credential`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, credentials }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        ctx.body = { ok: false, error: `Worker returned ${res.status}` }
        return
      }
      ctx.body = await res.json()
    } catch (err: any) {
      ctx.body = { ok: false, error: err.message ?? "Worker unreachable" }
    }
  },
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/strapi && npx tsc --noEmit 2>&1 | head -40
```

Expected: no new errors (there is a pre-existing ical.js type error — that is expected and not caused by these changes).

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/events/strapi-server.ts \
        apps/strapi/src/plugins/events/server/routes/admin.ts \
        apps/strapi/src/plugins/events/server/controllers/admin.ts
git commit -m "feat(strapi): events plugin pluginId + test-raw endpoint"
```

---

## Task 2: Registration — strapi-admin.tsx + admin/src/index.ts

**Files:**

- Create: `apps/strapi/src/plugins/events/strapi-admin.tsx`
- Create: `apps/strapi/src/plugins/events/admin/src/index.ts`

- [ ] **Step 1: Create strapi-admin.tsx**

```typescript
// apps/strapi/src/plugins/events/strapi-admin.tsx

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/events`,
      icon: CalendarIcon,
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

- [ ] **Step 2: Create admin/src/index.ts**

```typescript
// apps/strapi/src/plugins/events/admin/src/index.ts
export { EventsDashboard as App } from "./pages/EventsDashboard"
```

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/plugins/events/strapi-admin.tsx \
        apps/strapi/src/plugins/events/admin/src/index.ts
git commit -m "feat(strapi): events plugin admin registration"
```

---

## Task 3: EventsDashboard — 4-tab shell

**Files:**

- Create: `apps/strapi/src/plugins/events/admin/src/pages/EventsDashboard.tsx`

This file is a shell. All tab content components are imported stubs at this stage — they will be filled in by later tasks. Write them as placeholder components for now.

- [ ] **Step 1: Create EventsDashboard.tsx**

```typescript
// apps/strapi/src/plugins/events/admin/src/pages/EventsDashboard.tsx
import { Box, Button, Flex, Tabs, Typography } from "@strapi/design-system"
import { useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

import { CredentialList } from "../components/CredentialList"
import { ImportRunList } from "../components/ImportRunList"
import { PendingReviewList } from "../components/PendingReviewList"
import { WorkerHealth } from "../components/WorkerHealth"

// ── Dot indicator for worker tab ─────────────────────────────────────────────

function WorkerDot({ status }: { status: "idle" | "running" | "offline" | null }) {
  const color =
    status === "offline"
      ? "#d02b20"
      : status === null
        ? "#c0c0cf"
        : "#1b7c3a"

  return (
    <span
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
        marginLeft: "6px",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  )
}

// ── Count badge (reused across tabs) ─────────────────────────────────────────

export function CountBadge({ count }: { count: number }) {
  if (count === 0) return null

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "18px",
        height: "18px",
        padding: "0 5px",
        borderRadius: "9px",
        background: "#4945ff",
        color: "#fff",
        fontSize: "10px",
        fontWeight: 700,
        marginLeft: "6px",
      }}
    >
      {count}
    </span>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function EventsDashboard() {
  const { get } = useFetchClient()
  const [tab, setTab] = useState("credentials")
  const [pendingCount, setPendingCount] = useState(0)
  const [workerStatus, setWorkerStatus] = useState<"idle" | "running" | "offline" | null>(null)

  const fetchMeta = useCallback(async () => {
    try {
      const [pendingRes, healthRes] = await Promise.all([
        get("/events/admin/pending-review"),
        get("/events/admin/worker-health"),
      ])
      const pendingItems = Array.isArray((pendingRes.data as any)?.data)
        ? (pendingRes.data as any).data
        : Array.isArray(pendingRes.data)
          ? pendingRes.data
          : []
      setPendingCount(pendingItems.length)

      const health = (healthRes.data as any) ?? {}
      if (health.ok === false && health.status === "unreachable") {
        setWorkerStatus("offline")
      } else {
        setWorkerStatus(health.status === "running" ? "running" : "idle")
      }
    } catch {
      // silently ignore — individual tabs handle their own errors
    }
  }, [get])

  useEffect(() => {
    void fetchMeta()
  }, [fetchMeta])

  return (
    <Box padding={8} background="neutral100" minHeight="100vh">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Page header */}
      <Flex justifyContent="space-between" alignItems="flex-start" marginBottom={6}>
        <div>
          <Typography variant="alpha" fontWeight="bold">
            Events
          </Typography>
          <Box marginTop={1}>
            <Typography variant="epsilon" textColor="neutral500">
              Manage event source credentials, monitor imports, and review flagged events.
            </Typography>
          </Box>
        </div>
        <Button variant="ghost" size="S" onClick={() => void fetchMeta()}>
          ↻ Refresh
        </Button>
      </Flex>

      {/* Tabs */}
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List aria-label="Events management">
          <Tabs.Trigger value="credentials">Credentials</Tabs.Trigger>
          <Tabs.Trigger value="runs">Import Runs</Tabs.Trigger>
          <Tabs.Trigger value="review">
            <span style={{ display: "flex", alignItems: "center" }}>
              Pending Review
              <CountBadge count={pendingCount} />
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="worker">
            <span style={{ display: "flex", alignItems: "center" }}>
              Worker
              <WorkerDot status={workerStatus} />
            </span>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="credentials">
          <Box padding={6}>
            <CredentialList />
          </Box>
        </Tabs.Content>

        <Tabs.Content value="runs">
          <Box padding={6}>
            <ImportRunList />
          </Box>
        </Tabs.Content>

        <Tabs.Content value="review">
          <Box padding={6}>
            <PendingReviewList onCountChange={setPendingCount} />
          </Box>
        </Tabs.Content>

        <Tabs.Content value="worker">
          <Box padding={6}>
            <WorkerHealth onStatusChange={setWorkerStatus} />
          </Box>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/strapi/src/plugins/events/admin/src/pages/EventsDashboard.tsx
git commit -m "feat(strapi): events dashboard tab shell"
```

---

## Task 4: WorkerHealth component

**Files:**

- Create: `apps/strapi/src/plugins/events/admin/src/components/WorkerHealth.tsx`

- [ ] **Step 1: Create WorkerHealth.tsx**

```typescript
// apps/strapi/src/plugins/events/admin/src/components/WorkerHealth.tsx
import { useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

type WorkerStatus = "idle" | "running" | "offline"

type HealthData = {
  ok: boolean
  status?: WorkerStatus | "unreachable"
  lastSync?: {
    runId: string
    startedAt: string
    outcome: string
  }
  nextSync?: string
  version?: string
  cronExpression?: string
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#666687",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 3px",
}

const valueStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#32324d",
  fontWeight: 500,
  margin: 0,
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #f0f0ff" }}>
      <p style={labelStyle}>{label}</p>
      <p style={valueStyle}>{value}</p>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function WorkerHealth({
  onStatusChange,
}: {
  onStatusChange?: (status: "idle" | "running" | "offline") => void
}) {
  const { get } = useFetchClient()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await get("/events/admin/worker-health")
      const h = (data as HealthData) ?? {}
      setHealth(h)
      if (onStatusChange) {
        const s: WorkerStatus =
          h.ok === false || h.status === "unreachable"
            ? "offline"
            : h.status === "running"
              ? "running"
              : "idle"
        onStatusChange(s)
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to fetch worker health.")
    } finally {
      setLoading(false)
    }
  }, [get, onStatusChange])

  useEffect(() => {
    void load()
  }, [load])

  const isOffline =
    !health ||
    health.ok === false ||
    health.status === "unreachable"

  const statusLabel = isOffline
    ? "Offline"
    : health?.status === "running"
      ? "Running"
      : "Idle"

  const statusColor = isOffline ? "#d02b20" : health?.status === "running" ? "#0c75af" : "#1b7c3a"
  const dotColor = isOffline ? "#d02b20" : "#1b7c3a"

  return (
    <div style={{ maxWidth: "600px" }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #dcdce4",
          borderRadius: "8px",
          padding: "24px",
          boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
        }}
      >
        {loading && (
          <p style={{ color: "#8e8ea9", fontSize: "13px" }}>Loading…</p>
        )}

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "#ffeaea",
              border: "1px solid #f5c0be",
              borderRadius: "8px",
              fontSize: "13px",
              color: "#d02b20",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Status row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "24px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: dotColor,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: statusColor,
                }}
              >
                {statusLabel}
              </span>
            </div>

            {isOffline && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "#ffeaea",
                  border: "1px solid #f5c0be",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#d02b20",
                  marginBottom: "16px",
                }}
              >
                Worker offline — check <code>WORKER_URL</code> environment variable.
              </div>
            )}

            {!isOffline && (
              <div>
                {health?.lastSync && (
                  <>
                    <MetaRow label="Last sync run ID" value={health.lastSync.runId} />
                    <MetaRow label="Last sync started" value={formatDate(health.lastSync.startedAt)} />
                    <MetaRow label="Last sync outcome" value={health.lastSync.outcome} />
                  </>
                )}
                {health?.nextSync && (
                  <MetaRow label="Next scheduled sync" value={formatDate(health.nextSync)} />
                )}
                {health?.cronExpression && (
                  <MetaRow label="Cron expression" value={health.cronExpression} />
                )}
                {health?.version && (
                  <MetaRow label="Worker version" value={health.version} />
                )}
              </div>
            )}

            <div style={{ marginTop: "16px" }}>
              <button
                onClick={() => void load()}
                style={{
                  padding: "7px 14px",
                  fontSize: "12px",
                  fontWeight: 500,
                  background: "#fff",
                  border: "1px solid #dcdce4",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "#32324d",
                }}
              >
                ↻ Refresh
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/strapi/src/plugins/events/admin/src/components/WorkerHealth.tsx
git commit -m "feat(strapi): events dashboard WorkerHealth tab"
```

---

## Task 5: ImportRunList + ImportRunDetail

**Files:**

- Create: `apps/strapi/src/plugins/events/admin/src/components/ImportRunDetail.tsx`
- Create: `apps/strapi/src/plugins/events/admin/src/components/ImportRunList.tsx`

- [ ] **Step 1: Create ImportRunDetail.tsx**

```typescript
// apps/strapi/src/plugins/events/admin/src/components/ImportRunDetail.tsx

type FailedCredential = {
  credentialDocumentId: string
  label?: string
  error: string
}

type ProviderEntry = {
  fetched: number
  created: number
}

type RunRecord = {
  runId: string
  triggeredBy?: string
  startedAt?: string
  finishedAt?: string
  status: string
  stats?: {
    fetched?: number
    created?: number
    updated?: number
    unchanged?: number
    expired?: number
    pendingReview?: number
    errors?: number
  }
  providerBreakdown?: Record<string, ProviderEntry>
  failedCredentials?: FailedCredential[]
}

const cellStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "12px",
  color: "#32324d",
  borderBottom: "1px solid #f6f6f9",
  verticalAlign: "top",
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#666687",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "12px",
}

export function ImportRunDetail({ run }: { run: RunRecord }) {
  const stats = run.stats ?? {}
  const providers = run.providerBreakdown ?? {}
  const failed = run.failedCredentials ?? []

  return (
    <div
      style={{
        padding: "20px 24px",
        background: "#fafafa",
        borderTop: "1px solid #f0f0ff",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
        }}
      >
        {/* Event stats */}
        <div>
          <p style={labelStyle}>Event Stats</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Fetched", stats.fetched ?? 0],
                ["Created", stats.created ?? 0],
                ["Updated", stats.updated ?? 0],
                ["Unchanged", stats.unchanged ?? 0],
                ["Expired purged", stats.expired ?? 0],
                ["Pending review", stats.pendingReview ?? 0],
                ["Errors", stats.errors ?? 0],
              ].map(([label, val]) => (
                <tr key={String(label)}>
                  <td style={{ ...cellStyle, color: "#666687", width: "120px" }}>
                    {label}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      fontWeight: 600,
                      color:
                        label === "Errors" && Number(val) > 0
                          ? "#d02b20"
                          : label === "Created" && Number(val) > 0
                            ? "#1b7c3a"
                            : "#32324d",
                    }}
                  >
                    {val}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Provider breakdown */}
        <div>
          <p style={labelStyle}>Provider Breakdown</p>
          {Object.keys(providers).length === 0 ? (
            <p style={{ fontSize: "13px", color: "#8e8ea9" }}>No data</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Provider", "Fetched", "Created"].map((h) => (
                    <th
                      key={h}
                      style={{
                        ...cellStyle,
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "#666687",
                        textAlign: "left",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(providers).map(([provider, entry]) => (
                  <tr key={provider}>
                    <td style={cellStyle}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "12px",
                          color: "#4945ff",
                        }}
                      >
                        {provider}
                      </span>
                    </td>
                    <td style={cellStyle}>{entry.fetched}</td>
                    <td
                      style={{
                        ...cellStyle,
                        color: entry.created > 0 ? "#1b7c3a" : "#32324d",
                        fontWeight: entry.created > 0 ? 600 : 400,
                      }}
                    >
                      +{entry.created}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Failed credentials */}
      {failed.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <p style={labelStyle}>Failed Credentials</p>
          {failed.map((fc, i) => (
            <div
              key={i}
              style={{
                padding: "10px 14px",
                background: "#ffeaea",
                border: "1px solid #f5c0be",
                borderRadius: "6px",
                marginBottom: "8px",
                fontSize: "12px",
              }}
            >
              <span style={{ fontWeight: 600, color: "#d02b20" }}>
                {fc.label ?? fc.credentialDocumentId}
              </span>
              <span style={{ color: "#666687", marginLeft: "8px" }}>
                {fc.error}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create ImportRunList.tsx**

```typescript
// apps/strapi/src/plugins/events/admin/src/components/ImportRunList.tsx
import { useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useRef, useState } from "react"

import { ImportRunDetail } from "./ImportRunDetail"

type RunRecord = {
  runId: string
  triggeredBy?: string
  startedAt?: string
  finishedAt?: string
  status: string
  stats?: {
    fetched?: number
    created?: number
    updated?: number
    unchanged?: number
    expired?: number
    pendingReview?: number
    errors?: number
  }
  providerBreakdown?: Record<string, { fetched: number; created: number }>
  failedCredentials?: { credentialDocumentId: string; label?: string; error: string }[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  success: { bg: "#eafbf2", text: "#1b7c3a" },
  partial: { bg: "#fff3e0", text: "#d97706" },
  failed: { bg: "#ffeaea", text: "#d02b20" },
  running: { bg: "#eaf5ff", text: "#0c75af" },
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { bg: "#f0f0ff", text: "#4945ff" }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        background: colors.bg,
        color: colors.text,
      }}
    >
      {status === "running" && (
        <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>
          ⟳
        </span>
      )}
      {status}
    </span>
  )
}

function formatDate(iso?: string) {
  if (!iso) return "—"

  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function durationStr(startedAt?: string, finishedAt?: string) {
  if (!startedAt || !finishedAt) return "—"
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)

  return `${mins}m ${secs}s`
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#666687",
  whiteSpace: "nowrap",
  borderBottom: "2px solid #f0f0ff",
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "12px",
  color: "#32324d",
  verticalAlign: "middle",
  borderBottom: "1px solid #f6f6f9",
}

export function ImportRunList() {
  const { get, post } = useFetchClient()
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRuns = useCallback(async () => {
    try {
      const { data } = await get("/events/admin/runs")
      const items = Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray(data)
          ? data
          : []
      setRuns(items as RunRecord[])

      // Auto-refresh if any run is in "running" state
      if ((items as RunRecord[]).some((r) => r.status === "running")) {
        pollRef.current = setTimeout(() => void loadRuns(), 30_000)
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load import runs.")
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => {
    void loadRuns()

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [loadRuns])

  const triggerSync = async () => {
    setTriggerLoading(true)
    setTriggerMsg(null)
    try {
      await post("/events/admin/sync", {})
      setTriggerMsg("Sync command queued — worker picks up within 2 minutes.")
      setTimeout(() => void loadRuns(), 2_000)
    } catch (err: any) {
      setTriggerMsg(`Error: ${err?.message ?? "Failed to trigger sync"}`)
    } finally {
      setTriggerLoading(false)
    }
  }

  const toggleExpand = (runId: string) => {
    setExpandedRunId((prev) => (prev === runId ? null : runId))
  }

  return (
    <div>
      {/* Header actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: "#32324d",
          }}
        >
          Import Runs
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {triggerMsg && (
            <span
              style={{
                fontSize: "12px",
                color: triggerMsg.startsWith("Error") ? "#d02b20" : "#1b7c3a",
              }}
            >
              {triggerMsg}
            </span>
          )}
          <button
            onClick={() => void triggerSync()}
            disabled={triggerLoading}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: triggerLoading ? "#8e8ea9" : "#4945ff",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: triggerLoading ? "not-allowed" : "pointer",
            }}
          >
            {triggerLoading ? "Queuing…" : "⟳ Trigger Sync"}
          </button>
        </div>
      </div>

      {loading && (
        <p style={{ color: "#8e8ea9", fontSize: "13px" }}>Loading…</p>
      )}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#ffeaea",
            border: "1px solid #f5c0be",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#d02b20",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#fff",
            border: "1px solid #dcdce4",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>—</div>
          <p style={{ fontSize: "13px", color: "#666687", margin: 0 }}>
            No import runs yet. Trigger a sync above.
          </p>
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #dcdce4",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Run ID", "Triggered by", "Started", "Duration", "Status", "Created", "Updated", "Errors"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <>
                  <tr
                    key={run.runId}
                    onClick={() => toggleExpand(run.runId)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#4945ff" }}>
                        {run.runId.slice(0, 12)}…
                      </span>
                    </td>
                    <td style={tdStyle}>{run.triggeredBy ?? "scheduler"}</td>
                    <td style={tdStyle}>{formatDate(run.startedAt)}</td>
                    <td style={tdStyle}>{durationStr(run.startedAt, run.finishedAt)}</td>
                    <td style={tdStyle}>
                      <StatusBadge status={run.status} />
                    </td>
                    <td style={{ ...tdStyle, color: "#1b7c3a", fontWeight: 600 }}>
                      +{run.stats?.created ?? 0}
                    </td>
                    <td style={tdStyle}>{run.stats?.updated ?? 0}</td>
                    <td style={{ ...tdStyle, color: (run.stats?.errors ?? 0) > 0 ? "#d02b20" : "#32324d" }}>
                      {run.stats?.errors ?? 0}
                    </td>
                  </tr>
                  {expandedRunId === run.runId && (
                    <tr key={`${run.runId}-detail`}>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <ImportRunDetail run={run} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/plugins/events/admin/src/components/ImportRunDetail.tsx \
        apps/strapi/src/plugins/events/admin/src/components/ImportRunList.tsx
git commit -m "feat(strapi): events dashboard ImportRunList + ImportRunDetail"
```

---

## Task 6: PendingReviewList component

**Files:**

- Create: `apps/strapi/src/plugins/events/admin/src/components/PendingReviewList.tsx`

- [ ] **Step 1: Create PendingReviewList.tsx**

```typescript
// apps/strapi/src/plugins/events/admin/src/components/PendingReviewList.tsx
import { useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

type PendingEvent = {
  documentId: string
  title: string
  startTime?: string
  libraryEntityRef?: string
  sourceProvider?: string
  url?: string
  venueMatchConfidence?: number
  venueName?: string
  matchedLibraryName?: string
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#666687",
  whiteSpace: "nowrap",
  borderBottom: "2px solid #f0f0ff",
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "12px",
  color: "#32324d",
  verticalAlign: "middle",
  borderBottom: "1px solid #f6f6f9",
}

const PROVIDER_COLORS: Record<string, string> = {
  eventbrite: "#ff6060",
  ical: "#1b7c3a",
  custom_ical: "#1b7c3a",
  meetup: "#e8174b",
  google_events: "#4285f4",
  facebook_events: "#1877f2",
  librarycloud: "#0c75af",
}

function ProviderBadge({ provider }: { provider: string }) {
  const color = PROVIDER_COLORS[provider] ?? "#8e8ea9"

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: 700,
        background: color + "18",
        color,
        border: `1px solid ${color}40`,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {provider.replace("_", " ")}
    </span>
  )
}

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence === undefined) return <span style={{ color: "#c0c0cf" }}>—</span>
  const pct = Math.round(confidence * 100)
  const color = pct >= 80 ? "#1b7c3a" : pct >= 50 ? "#d97706" : "#d02b20"

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        background: color + "15",
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {pct}%
    </span>
  )
}

function formatDate(iso?: string) {
  if (!iso) return "—"

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function PendingReviewList({
  onCountChange,
}: {
  onCountChange?: (count: number) => void
}) {
  const { get, patch } = useFetchClient()
  const [events, setEvents] = useState<PendingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set())

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await get("/events/admin/pending-review")
      const items = Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray(data)
          ? data
          : []
      setEvents(items as PendingEvent[])
      onCountChange?.(items.length)
    } catch (err: any) {
      setError(err?.message ?? "Failed to load pending review queue.")
    } finally {
      setLoading(false)
    }
  }, [get, onCountChange])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const handleAction = async (documentId: string, action: "approve" | "discard") => {
    setActionLoading((prev) => ({ ...prev, [documentId]: true }))
    try {
      await patch(`/events/admin/pending-review/${documentId}`, { action })
      // Fade out row, then remove
      setFadingOut((prev) => new Set(prev).add(documentId))
      setTimeout(() => {
        setEvents((prev) => {
          const updated = prev.filter((e) => e.documentId !== documentId)
          onCountChange?.(updated.length)

          return updated
        })
        setFadingOut((prev) => {
          const next = new Set(prev)
          next.delete(documentId)

          return next
        })
      }, 350)
    } catch (err: any) {
      setError(`Action failed: ${err?.message ?? "unknown error"}`)
    } finally {
      setActionLoading((prev) => ({ ...prev, [documentId]: false }))
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#32324d" }}>
          Pending Review Queue
        </p>
        <button
          onClick={() => void loadEvents()}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 500,
            background: "#fff",
            border: "1px solid #dcdce4",
            borderRadius: "6px",
            cursor: "pointer",
            color: "#32324d",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#ffeaea",
            border: "1px solid #f5c0be",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#d02b20",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <p style={{ color: "#8e8ea9", fontSize: "13px" }}>Loading…</p>
      )}

      {!loading && events.length === 0 && (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#fff",
            border: "1px solid #dcdce4",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>✓</div>
          <p style={{ fontSize: "14px", color: "#666687", margin: 0 }}>
            Queue is clear — no events pending review.
          </p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #dcdce4",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Event", "Venue", "Matched Library", "Confidence", "Date", "Actions"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={ev.documentId}
                  style={{
                    opacity: fadingOut.has(ev.documentId) ? 0 : 1,
                    transition: "opacity 0.35s",
                  }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, marginBottom: "3px" }}>
                      {ev.title}
                    </div>
                    <ProviderBadge provider={ev.sourceProvider ?? "unknown"} />
                  </td>
                  <td style={tdStyle}>{ev.venueName ?? "—"}</td>
                  <td style={tdStyle}>
                    {ev.matchedLibraryName ? (
                      <div>
                        <div style={{ fontWeight: 500 }}>{ev.matchedLibraryName}</div>
                        {ev.libraryEntityRef && (
                          <div
                            style={{
                              fontSize: "11px",
                              fontFamily: "monospace",
                              color: "#8e8ea9",
                            }}
                          >
                            {ev.libraryEntityRef}
                          </div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={tdStyle}>
                    <ConfidenceBadge confidence={ev.venueMatchConfidence} />
                  </td>
                  <td style={tdStyle}>{formatDate(ev.startTime)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => void handleAction(ev.documentId, "approve")}
                        disabled={actionLoading[ev.documentId]}
                        style={{
                          padding: "5px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: "#eafbf2",
                          color: "#1b7c3a",
                          border: "1px solid #a5dfc0",
                          borderRadius: "5px",
                          cursor: actionLoading[ev.documentId] ? "not-allowed" : "pointer",
                          opacity: actionLoading[ev.documentId] ? 0.5 : 1,
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => void handleAction(ev.documentId, "discard")}
                        disabled={actionLoading[ev.documentId]}
                        style={{
                          padding: "5px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: "#ffeaea",
                          color: "#d02b20",
                          border: "1px solid #f5c0be",
                          borderRadius: "5px",
                          cursor: actionLoading[ev.documentId] ? "not-allowed" : "pointer",
                          opacity: actionLoading[ev.documentId] ? 0.5 : 1,
                        }}
                      >
                        Discard
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/strapi/src/plugins/events/admin/src/components/PendingReviewList.tsx
git commit -m "feat(strapi): events dashboard PendingReviewList"
```

---

## Task 7: CredentialList component

**Files:**

- Create: `apps/strapi/src/plugins/events/admin/src/components/CredentialList.tsx`

- [ ] **Step 1: Create CredentialList.tsx**

```typescript
// apps/strapi/src/plugins/events/admin/src/components/CredentialList.tsx
import { useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

import { CredentialForm } from "./CredentialForm"

type Library = {
  documentId: string
  name: string
  entityRef?: string
}

type Credential = {
  documentId: string
  label: string
  provider: string
  scope: string
  isActive: boolean
  libraries?: Library[]
  lastSyncAt?: string
  lastSyncEventCount?: number
  lastSyncError?: string
}

const PROVIDER_COLORS: Record<string, string> = {
  eventbrite: "#ff6060",
  ical: "#1b7c3a",
  custom_ical: "#1b7c3a",
  meetup: "#e8174b",
  google_events: "#4285f4",
  facebook_events: "#1877f2",
  librarycloud: "#0c75af",
}

function ProviderBadge({ provider }: { provider: string }) {
  const color = PROVIDER_COLORS[provider] ?? "#8e8ea9"

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: 700,
        background: color + "18",
        color,
        border: `1px solid ${color}40`,
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
      }}
    >
      {provider.replace(/_/g, " ")}
    </span>
  )
}

function formatDate(iso?: string) {
  if (!iso) return null

  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function CredentialCard({
  cred,
  onEdit,
  onDeleted,
}: {
  cred: Credential
  onEdit: (cred: Credential) => void
  onDeleted: () => void
}) {
  const { del, post } = useFetchClient()
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const hasError = !!cred.lastSyncError

  const handleTest = async () => {
    setTestLoading(true)
    setTestResult(null)
    try {
      const { data } = await post(`/events/admin/credentials/${cred.documentId}/test`, {})
      setTestResult(data as { ok: boolean; message?: string; error?: string })
    } catch (err: any) {
      setTestResult({ ok: false, error: err?.message ?? "Test failed" })
    } finally {
      setTestLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete credential "${cred.label}"? This cannot be undone.`)) return
    setDeleteLoading(true)
    try {
      await del(`/events/admin/credentials/${cred.documentId}`)
      onDeleted()
    } catch {
      alert("Delete failed — check server logs.")
    } finally {
      setDeleteLoading(false)
    }
  }

  const libraryNames =
    cred.libraries && cred.libraries.length > 0
      ? cred.libraries.length === 1
        ? cred.libraries[0]!.name
        : `${cred.libraries.length} libraries linked`
      : "No libraries linked"

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dcdce4",
        borderLeft: `4px solid ${hasError ? "#d02b20" : "#1b7c3a"}`,
        borderRadius: "8px",
        padding: "16px 18px",
        boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: "14px",
              fontWeight: 700,
              color: "#32324d",
            }}
          >
            {cred.label}
          </p>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <ProviderBadge provider={cred.provider} />
            <span
              style={{
                fontSize: "11px",
                color: "#8e8ea9",
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
              }}
            >
              {cred.scope}
            </span>
            {!cred.isActive && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#666687",
                  background: "#f0f0ff",
                  border: "1px solid #dcdce4",
                  borderRadius: "4px",
                  padding: "1px 6px",
                  textTransform: "uppercase" as const,
                }}
              >
                Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Libraries */}
      <p style={{ margin: 0, fontSize: "12px", color: "#666687" }}>{libraryNames}</p>

      {/* Last sync info */}
      {cred.lastSyncAt && (
        <p style={{ margin: 0, fontSize: "11px", color: "#8e8ea9" }}>
          Last sync: {formatDate(cred.lastSyncAt)}
          {cred.lastSyncEventCount !== undefined && ` · ${cred.lastSyncEventCount} events`}
        </p>
      )}
      {cred.lastSyncError && (
        <p
          style={{
            margin: 0,
            fontSize: "11px",
            color: "#d02b20",
            wordBreak: "break-word",
          }}
        >
          {cred.lastSyncError}
        </p>
      )}

      {/* Test result */}
      {testResult && (
        <p
          style={{
            margin: 0,
            fontSize: "11px",
            color: testResult.ok ? "#1b7c3a" : "#d02b20",
          }}
        >
          {testResult.ok
            ? `✓ ${testResult.message ?? "Connection OK"}`
            : `✗ ${testResult.error ?? "Test failed"}`}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
        <button
          onClick={() => onEdit(cred)}
          style={{
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 600,
            background: "#f0f0ff",
            color: "#4945ff",
            border: "1px solid #c4c4ff",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Edit
        </button>
        <button
          onClick={() => void handleTest()}
          disabled={testLoading}
          style={{
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 600,
            background: "#fff",
            color: "#666687",
            border: "1px solid #dcdce4",
            borderRadius: "5px",
            cursor: testLoading ? "not-allowed" : "pointer",
            opacity: testLoading ? 0.5 : 1,
          }}
        >
          {testLoading ? "Testing…" : "Test"}
        </button>
        <button
          onClick={() => void handleDelete()}
          disabled={deleteLoading}
          style={{
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 600,
            background: "#ffeaea",
            color: "#d02b20",
            border: "1px solid #f5c0be",
            borderRadius: "5px",
            cursor: deleteLoading ? "not-allowed" : "pointer",
            opacity: deleteLoading ? 0.5 : 1,
            marginLeft: "auto",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export function CredentialList() {
  const { get } = useFetchClient()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Credential | null>(null)

  const loadCredentials = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await get("/events/admin/credentials")
      const items = Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray(data)
          ? data
          : []
      setCredentials(items as Credential[])
    } catch (err: any) {
      setError(err?.message ?? "Failed to load credentials.")
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => {
    void loadCredentials()
  }, [loadCredentials])

  const openCreate = () => {
    setEditTarget(null)
    setFormOpen(true)
  }

  const openEdit = (cred: Credential) => {
    setEditTarget(cred)
    setFormOpen(true)
  }

  const handleSaved = () => {
    setFormOpen(false)
    setEditTarget(null)
    void loadCredentials()
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#32324d" }}>
          Event Source Credentials
        </p>
        <button
          onClick={openCreate}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            background: "#4945ff",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          + Add Credential
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#ffeaea",
            border: "1px solid #f5c0be",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#d02b20",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {loading && <p style={{ color: "#8e8ea9", fontSize: "13px" }}>Loading…</p>}

      {!loading && credentials.length === 0 && !error && (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#fff",
            border: "1px dashed #dcdce4",
            borderRadius: "8px",
            cursor: "pointer",
          }}
          onClick={openCreate}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>+</div>
          <p style={{ fontSize: "13px", color: "#666687", margin: 0 }}>
            No credentials yet — click to add one
          </p>
        </div>
      )}

      {!loading && credentials.length > 0 && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {credentials.map((cred) => (
              <CredentialCard
                key={cred.documentId}
                cred={cred}
                onEdit={openEdit}
                onDeleted={() => void loadCredentials()}
              />
            ))}

            {/* Add card */}
            <div
              onClick={openCreate}
              style={{
                background: "#fff",
                border: "1px dashed #dcdce4",
                borderRadius: "8px",
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: "pointer",
                minHeight: "120px",
                color: "#8e8ea9",
                fontSize: "13px",
                fontWeight: 500,
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.borderColor = "#4945ff"
                el.style.color = "#4945ff"
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.borderColor = "#dcdce4"
                el.style.color = "#8e8ea9"
              }}
            >
              <span style={{ fontSize: "24px" }}>+</span>
              Add Credential
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {formOpen && (
        <CredentialForm
          credential={editTarget}
          onSaved={handleSaved}
          onCancel={() => {
            setFormOpen(false)
            setEditTarget(null)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/strapi/src/plugins/events/admin/src/components/CredentialList.tsx
git commit -m "feat(strapi): events dashboard CredentialList"
```

---

## Task 8: CredentialForm component

**Files:**

- Create: `apps/strapi/src/plugins/events/admin/src/components/CredentialForm.tsx`

This is the most complex component — a modal with dynamic per-provider fields and a library search-as-you-type multi-select.

- [ ] **Step 1: Create CredentialForm.tsx**

```typescript
// apps/strapi/src/plugins/events/admin/src/components/CredentialForm.tsx
import { useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useRef, useState } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

type Library = {
  documentId: string
  name: string
  entityRef?: string
}

type Credential = {
  documentId: string
  label: string
  provider: string
  scope: string
  isActive: boolean
  libraries?: Library[]
}

// ── Provider field definitions ────────────────────────────────────────────────

type FieldDef = { key: string; label: string; type: "text" | "password" }

const PROVIDER_FIELDS: Record<string, FieldDef[]> = {
  eventbrite: [
    { key: "apiKey", label: "API Key (private token)", type: "password" },
    { key: "orgId", label: "Organisation ID", type: "text" },
  ],
  ical: [
    { key: "feedUrl", label: "Feed URL", type: "text" },
  ],
  custom_ical: [
    { key: "feedUrl", label: "Feed URL", type: "text" },
  ],
  meetup: [
    { key: "apiKey", label: "API Key", type: "password" },
  ],
  google_events: [
    { key: "apiKey", label: "API Key", type: "password" },
    { key: "calendarId", label: "Calendar ID", type: "text" },
  ],
  facebook_events: [
    { key: "accessToken", label: "Access Token", type: "password" },
    { key: "pageId", label: "Page ID", type: "text" },
  ],
  librarycloud: [
    { key: "apiKey", label: "API Key", type: "password" },
  ],
}

const PROVIDERS = [
  { value: "eventbrite", label: "Eventbrite" },
  { value: "ical", label: "iCal" },
  { value: "custom_ical", label: "Custom iCal" },
  { value: "meetup", label: "Meetup" },
  { value: "google_events", label: "Google Events" },
  { value: "facebook_events", label: "Facebook Events" },
  { value: "librarycloud", label: "LibraryCloud" },
]

// ── Shared input styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "13px",
  color: "#32324d",
  background: "#fff",
  border: "1px solid #dcdce4",
  borderRadius: "6px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#666687",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "4px",
  display: "block",
}

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#4945ff",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 10px",
  paddingBottom: "6px",
  borderBottom: "1px solid #f0f0ff",
}

// ── Library search multi-select ───────────────────────────────────────────────

function LibrarySearch({
  selected,
  onChange,
  maxOne,
}: {
  selected: Library[]
  onChange: (libs: Library[]) => void
  maxOne: boolean
}) {
  const { get } = useFetchClient()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Library[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(
    async (q: string) => {
      if (!q || q.length < 2) {
        setResults([])

        return
      }
      setSearching(true)
      try {
        const { data } = await get(
          `/api/libraries?filters[name][$containsi]=${encodeURIComponent(q)}&pagination[pageSize]=10&fields[0]=name&fields[1]=entityRef`
        )
        const items = (data as any)?.data ?? []
        setResults(
          items.map((item: any) => ({
            documentId: item.documentId,
            name: item.name,
            entityRef: item.entityRef,
          }))
        )
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    },
    [get]
  )

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void search(val), 300)
  }

  const addLibrary = (lib: Library) => {
    if (selected.some((s) => s.documentId === lib.documentId)) return
    if (maxOne) {
      onChange([lib])
    } else {
      onChange([...selected, lib])
    }
    setQuery("")
    setResults([])
  }

  const removeLibrary = (documentId: string) => {
    onChange(selected.filter((s) => s.documentId !== documentId))
  }

  return (
    <div>
      {/* Selected tags */}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
          {selected.map((lib) => (
            <span
              key={lib.documentId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 8px",
                borderRadius: "100px",
                background: "#f0f0ff",
                border: "1px solid #c4c4ff",
                fontSize: "12px",
                color: "#4945ff",
                fontWeight: 500,
              }}
            >
              {lib.name}
              {lib.entityRef && (
                <span style={{ color: "#8e8ea9", fontSize: "10px" }}>{lib.entityRef}</span>
              )}
              <button
                onClick={() => removeLibrary(lib.documentId)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#8e8ea9",
                  fontSize: "14px",
                  lineHeight: 1,
                  padding: "0 2px",
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      {(!maxOne || selected.length === 0) && (
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={query}
            onChange={handleInput}
            placeholder="Search libraries by name…"
            style={inputStyle}
          />
          {searching && (
            <span
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "11px",
                color: "#8e8ea9",
              }}
            >
              Searching…
            </span>
          )}
          {results.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "#fff",
                border: "1px solid #dcdce4",
                borderRadius: "6px",
                boxShadow: "0 4px 12px rgba(33,33,52,0.12)",
                zIndex: 100,
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {results.map((lib) => (
                <div
                  key={lib.documentId}
                  onClick={() => addLibrary(lib)}
                  style={{
                    padding: "9px 12px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #f6f6f9",
                    fontSize: "13px",
                    color: "#32324d",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <span>{lib.name}</span>
                  {lib.entityRef && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        color: "#8e8ea9",
                      }}
                    >
                      {lib.entityRef}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal overlay ─────────────────────────────────────────────────────────────

export function CredentialForm({
  credential,
  onSaved,
  onCancel,
}: {
  credential: Credential | null
  onSaved: () => void
  onCancel: () => void
}) {
  const { post, put } = useFetchClient()
  const isEdit = !!credential

  // Form state
  const [label, setLabel] = useState(credential?.label ?? "")
  const [provider, setProvider] = useState(credential?.provider ?? "eventbrite")
  const [scope, setScope] = useState(credential?.scope ?? "library")
  const [isActive, setIsActive] = useState(credential?.isActive ?? true)
  const [credFields, setCredFields] = useState<Record<string, string>>({})
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>(
    credential?.libraries ?? []
  )

  // UI state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null)

  // Reset cred fields when provider changes
  useEffect(() => {
    setCredFields({})
    setTestResult(null)
  }, [provider])

  const providerFields = PROVIDER_FIELDS[provider] ?? []

  const setField = (key: string, value: string) => {
    setCredFields((prev) => ({ ...prev, [key]: value }))
  }

  const allCredsPresent = providerFields.every((f) => credFields[f.key]?.trim())

  const handleSave = async () => {
    if (!label.trim()) {
      setSaveError("Label is required.")

      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        label: label.trim(),
        provider,
        scope,
        isActive,
        libraryDocumentIds: selectedLibraries.map((l) => l.documentId),
        credentials: credFields,
      }

      if (isEdit) {
        await put(`/events/admin/credentials/${credential!.documentId}`, payload)
      } else {
        await post("/events/admin/credentials", payload)
      }
      onSaved()
    } catch (err: any) {
      setSaveError(err?.message ?? "Save failed — check server logs.")
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTestLoading(true)
    setTestResult(null)
    try {
      let data: { ok: boolean; message?: string; error?: string }
      if (isEdit) {
        const res = await post(`/events/admin/credentials/${credential!.documentId}/test`, {})
        data = res.data as typeof data
      } else {
        const res = await post("/events/admin/credentials/test-raw", {
          provider,
          credentials: credFields,
        })
        data = res.data as typeof data
      }
      setTestResult(data)
    } catch (err: any) {
      setTestResult({ ok: false, error: err?.message ?? "Test failed" })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(33,33,52,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          width: "520px",
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(33,33,52,0.20)",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #f0f0ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#32324d" }}>
            {isEdit ? "Edit Credential" : "Add Credential"}
          </p>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#8e8ea9",
              fontSize: "20px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Modal body — scrollable */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Label */}
          <div>
            <label style={labelStyle}>Label *</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. British Library — Eventbrite"
              style={inputStyle}
            />
          </div>

          {/* Provider */}
          <div>
            <label style={labelStyle}>Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              style={inputStyle}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Scope */}
          <div>
            <label style={labelStyle}>Scope</label>
            <div style={{ display: "flex", gap: "16px" }}>
              {[
                { value: "library", label: "Library (single)" },
                { value: "group", label: "Group (venue match)" },
              ].map(({ value, label: optLabel }) => (
                <label
                  key={value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "13px",
                    color: "#32324d",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                  />
                  {optLabel}
                </label>
              ))}
            </div>
          </div>

          {/* Libraries */}
          <div>
            <label style={labelStyle}>
              {scope === "library" ? "Library" : "Libraries"}
            </label>
            <LibrarySearch
              selected={selectedLibraries}
              onChange={setSelectedLibraries}
              maxOne={scope === "library"}
            />
          </div>

          {/* Dynamic credential fields */}
          {providerFields.length > 0 && (
            <div>
              <p style={sectionHeadingStyle}>
                {PROVIDERS.find((p) => p.value === provider)?.label ?? provider} Credentials
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {providerFields.map((field) => (
                  <div key={field.key}>
                    <label style={labelStyle}>{field.label}</label>
                    <input
                      type={field.type}
                      value={credFields[field.key] ?? ""}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.type === "password" ? "••••••••••••••••" : ""}
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "#32324d",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active (include in sync runs)
          </label>
        </div>

        {/* Modal footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #f0f0ff",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: "#fff",
              color: "#666687",
              border: "1px solid #dcdce4",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={() => void handleTest()}
            disabled={testLoading || (!isEdit && !allCredsPresent)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: "#fff",
              color: "#4945ff",
              border: "1px solid #c4c4ff",
              borderRadius: "6px",
              cursor: testLoading || (!isEdit && !allCredsPresent) ? "not-allowed" : "pointer",
              opacity: testLoading || (!isEdit && !allCredsPresent) ? 0.5 : 1,
            }}
          >
            {testLoading ? "Testing…" : "Test Connection"}
          </button>

          <button
            onClick={() => void handleSave()}
            disabled={saving || !label.trim()}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: saving || !label.trim() ? "#8e8ea9" : "#4945ff",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: saving || !label.trim() ? "not-allowed" : "pointer",
              marginLeft: "auto",
            }}
          >
            {saving ? "Saving…" : "Save Credential"}
          </button>
        </div>

        {/* Test + save error feedback (below footer) */}
        {(testResult || saveError) && (
          <div style={{ padding: "0 24px 16px" }}>
            {testResult && (
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: "12px",
                  color: testResult.ok ? "#1b7c3a" : "#d02b20",
                }}
              >
                {testResult.ok
                  ? `✓ ${testResult.message ?? "Connection OK"}`
                  : `✗ ${testResult.error ?? "Test failed"}`}
              </p>
            )}
            {saveError && (
              <p style={{ margin: 0, fontSize: "12px", color: "#d02b20" }}>
                {saveError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/strapi && npx tsc --noEmit 2>&1 | head -40
```

Expected: no new errors beyond the pre-existing ical.js type error.

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/plugins/events/admin/src/components/CredentialForm.tsx
git commit -m "feat(strapi): events dashboard CredentialForm modal"
```

---

## Task 9: Build verification + wire-up check

**Files:**

- No new files — this task verifies the build.

- [ ] **Step 1: Verify Strapi TypeScript compiles clean**

```bash
cd apps/strapi && npx tsc --noEmit 2>&1 | head -60
```

Expected: only the pre-existing `ical.js` type error (`Property 'timezone' does not exist on type 'Time'`). No new errors.

- [ ] **Step 2: Verify all 4 plugins build**

```bash
cd apps/strapi && pnpm build 2>&1 | tail -30
```

Expected: all 4 plugins compile — content-moderation, rewards, events, global-field. No build failures.

- [ ] **Step 3: Verify plugin registration**

Start Strapi in dev mode and confirm the Events menu item appears in the sidebar:

```bash
cd apps/strapi && pnpm develop 2>&1 | head -50
```

Then open `http://127.0.0.1:1337/admin`, sign in, and confirm a calendar icon "Events" item appears in the left sidebar alongside Rewards and Content Moderation.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(strapi): events admin dashboard — complete implementation"
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec requirement                                         | Covered by                 |
| -------------------------------------------------------- | -------------------------- |
| Register menu link with CalendarIcon                     | Task 2                     |
| 4 tabs: Credentials, Import Runs, Pending Review, Worker | Task 3                     |
| Pending Review badge count                               | Task 3 (`CountBadge`)      |
| Worker dot (green/red)                                   | Task 3 (`WorkerDot`)       |
| Credential card grid with left-border colour             | Task 7                     |
| Edit/Test/Delete card actions                            | Task 7                     |
| + Add Credential button + dashed add card                | Task 7                     |
| CredentialForm modal (520px)                             | Task 8                     |
| Dynamic fields per provider                              | Task 8 (`PROVIDER_FIELDS`) |
| Library search-as-you-type                               | Task 8 (`LibrarySearch`)   |
| Max 1 library for Library scope                          | Task 8 (`maxOne` prop)     |
| Test Connection (saved) → `/:documentId/test`            | Task 8                     |
| Test Connection (unsaved) → `/test-raw`                  | Task 8 + Task 1            |
| `POST /admin/credentials/test-raw` backend route         | Task 1                     |
| `testRaw` controller handler                             | Task 1                     |
| `pluginId: "events"` in strapi-server.ts                 | Task 1                     |
| Import runs table with status badges                     | Task 5                     |
| Expandable run detail panel                              | Task 5                     |
| Trigger Sync button + 2s auto-refresh                    | Task 5                     |
| Auto-refresh every 30s when running                      | Task 5                     |
| Pending review approve/discard with fade                 | Task 6                     |
| Empty state queue clear message                          | Task 6                     |
| Worker health card: status/last sync/next sync/version   | Task 4                     |
| Offline state with error message                         | Task 4                     |
| All API errors shown inline                              | All components             |
| Loading spinners on async                                | All components             |
| Credential delete confirm dialog                         | Task 7                     |
