import { Box, Button, Flex, Tabs, Typography } from "@strapi/design-system"
import { useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

import { CredentialList } from "../components/CredentialList"
import { ImportRunList } from "../components/ImportRunList"
import { PendingReviewList } from "../components/PendingReviewList"
import { WorkerHealth } from "../components/WorkerHealth"

// ── Dot indicator for worker tab ─────────────────────────────────────────────

function WorkerDot({
  status,
}: {
  status: "idle" | "running" | "offline" | null
}) {
  const color =
    status === "offline" ? "#d02b20" : status === null ? "#c0c0cf" : "#1b7c3a"

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
  const [workerStatus, setWorkerStatus] = useState<
    "idle" | "running" | "offline" | null
  >(null)

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
      <Flex
        justifyContent="space-between"
        alignItems="flex-start"
        marginBottom={6}
      >
        <div>
          <Typography variant="alpha" fontWeight="bold">
            Events
          </Typography>
          <Box marginTop={1}>
            <Typography variant="epsilon" textColor="neutral500">
              Manage event source credentials, monitor imports, and review
              flagged events.
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
