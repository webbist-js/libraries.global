import {
  Badge,
  Box,
  Button,
  Flex,
  Tabs,
  Typography,
} from "@strapi/design-system"
import {
  Layouts,
  Page,
  useAuth,
  useFetchClient,
  useRBAC,
} from "@strapi/strapi/admin"
import { useEffect, useState } from "react"

import { ProviderAnalytics } from "./ProviderAnalytics"
import { PluginPage } from "../../../../../admin/components/PluginUI"
import { CredentialList } from "../components/CredentialList"
import { ImportRunList } from "../components/ImportRunList"
import { PendingReviewList } from "../components/PendingReviewList"
import { WorkerHealth } from "../components/WorkerHealth"

const PERMISSIONS = ["read", "manage-credentials", "review"].map((action) => ({
  action: `plugin::events.${action}`,
  subject: null,
}))

export function CountBadge({ count }: { count: number }) {
  return count > 0 ? <Badge size="S">{count}</Badge> : null
}
export function EventsDashboard() {
  const loading = useAuth("Events", (state) => state.isLoading)
  const user = useAuth("Events", (state) => state.user)
  const permissions = useAuth("Events", (state) => state.permissions)
  if (loading) return <Page.Loading />

  return <ReadyEvents key={`${user?.id}:${JSON.stringify(permissions)}`} />
}
function ReadyEvents() {
  const { allowedActions, isLoading, error } = useRBAC(PERMISSIONS)
  if (isLoading) return <Page.Loading />
  if (error) return <Page.Error />
  if (!allowedActions.canRead) return <Page.NoPermissions />

  return (
    <EventsContent
      canManage={!!allowedActions.canManageCredentials}
      canReview={!!allowedActions.canReview}
    />
  )
}
function EventsContent({
  canManage,
  canReview,
}: {
  canManage: boolean
  canReview: boolean
}) {
  const { get } = useFetchClient()
  const [tab, setTab] = useState("credentials")
  const [pendingCount, setPendingCount] = useState(0)
  const [workerStatus, setWorkerStatus] = useState<
    "idle" | "running" | "offline" | null
  >(null)
  const [revision, setRevision] = useState(0)
  const [metaError, setMetaError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    // Reset the external request state when its identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMetaError(false)
    Promise.all([
      get<{ meta: { total: number } }>("/events/admin/pending-review?limit=1", {
        signal: controller.signal,
      }),
      get<{ ok: boolean; status?: string }>("/events/admin/worker-health", {
        signal: controller.signal,
      }),
    ])
      .then(([pending, health]) => {
        if (controller.signal.aborted) return
        setPendingCount(pending.data.meta.total)
        setWorkerStatus(
          !health.data.ok || health.data.status === "unreachable"
            ? "offline"
            : health.data.status === "running"
              ? "running"
              : "idle"
        )
      })
      .catch(() => {
        if (!controller.signal.aborted) setMetaError(true)
      })

    return () => controller.abort()
  }, [get, revision])

  return (
    <PluginPage>
      <Layouts.Root>
        <Layouts.Header
          title="Events"
          subtitle="Connect event sources, monitor imports and review the public programme."
          primaryAction={
            <Button
              variant="secondary"
              onClick={() => setRevision((value) => value + 1)}
            >
              Refresh status
            </Button>
          }
        />
        <Layouts.Content>
          {metaError && (
            <Box paddingBottom={4}>
              <Typography role="status" textColor="danger600">
                Status is unavailable. Use Refresh status to retry; each tab has
                its own refresh control.
              </Typography>
            </Box>
          )}
          <Tabs.Root value={tab} onValueChange={setTab}>
            <Box
              color="neutral500"
              style={{
                overflowX: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: "currentColor transparent",
              }}
            >
              <Tabs.List
                aria-label="Events management"
                style={{
                  width: "max-content",
                  minWidth: "max-content",
                  whiteSpace: "nowrap",
                }}
              >
                <Tabs.Trigger value="credentials">Credentials</Tabs.Trigger>
                <Tabs.Trigger value="runs">Imports</Tabs.Trigger>
                <Tabs.Trigger value="review">
                  <Flex gap={2}>
                    Pending review
                    <CountBadge count={pendingCount} />
                  </Flex>
                </Tabs.Trigger>
                <Tabs.Trigger value="worker">
                  <Flex gap={2}>
                    Worker
                    {workerStatus && <Badge size="S">{workerStatus}</Badge>}
                  </Flex>
                </Tabs.Trigger>
                <Tabs.Trigger value="providers">
                  Provider analytics
                </Tabs.Trigger>
              </Tabs.List>
            </Box>
            <Tabs.Content value="credentials">
              <Box
                padding={6}
                marginTop={6}
                background="neutral0"
                hasRadius
                shadow="tableShadow"
              >
                <CredentialList />
              </Box>
            </Tabs.Content>
            <Tabs.Content value="runs">
              <Box
                background="neutral0"
                padding={6}
                marginTop={6}
                hasRadius
                shadow="tableShadow"
              >
                <ImportRunList canManage={canManage} />
              </Box>
            </Tabs.Content>
            <Tabs.Content value="review">
              <Box
                background="neutral0"
                padding={6}
                marginTop={6}
                hasRadius
                shadow="tableShadow"
              >
                <PendingReviewList
                  canReview={canReview}
                  onCountChange={setPendingCount}
                />
              </Box>
            </Tabs.Content>
            <Tabs.Content value="worker">
              <Box paddingTop={6}>
                <WorkerHealth onStatusChange={setWorkerStatus} />
              </Box>
            </Tabs.Content>
            <Tabs.Content value="providers">
              <Box
                background="neutral0"
                padding={6}
                marginTop={6}
                hasRadius
                shadow="tableShadow"
              >
                <ProviderAnalytics />
              </Box>
            </Tabs.Content>
          </Tabs.Root>
        </Layouts.Content>
      </Layouts.Root>
    </PluginPage>
  )
}
