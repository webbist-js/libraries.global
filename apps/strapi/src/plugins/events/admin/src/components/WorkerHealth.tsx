import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  Loader,
  Typography,
} from "@strapi/design-system"
import { useFetchClient } from "@strapi/strapi/admin"
import { useEffect, useRef, useState } from "react"

type Status = "idle" | "running" | "offline"
type Health = {
  ok: boolean
  status?: Status | "unreachable"
  lastSync?: { runId: string; startedAt: string; outcome: string }
  nextSync?: string
  version?: string
  cronExpression?: string
}

const date = (value?: string) =>
  value ? new Date(value).toLocaleString() : "Not available"

export function WorkerHealth({
  onStatusChange,
}: {
  onStatusChange?: (status: Status) => void
}) {
  const { get } = useFetchClient()
  const [health, setHealth] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const notify = useRef(onStatusChange)
  useEffect(() => {
    notify.current = onStatusChange
  }, [onStatusChange])
  useEffect(() => {
    const controller = new AbortController()
    // Reset the external request state on an explicit refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(false)
    get<Health>("/events/admin/worker-health", {
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (controller.signal.aborted) return
        setHealth(data)
        notify.current?.(
          !data.ok || data.status === "unreachable"
            ? "offline"
            : data.status === "running"
              ? "running"
              : "idle"
        )
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true)
          notify.current?.("offline")
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [get, revision])
  const status =
    !health?.ok || health.status === "unreachable"
      ? "Offline"
      : health.status === "running"
        ? "Running"
        : "Idle"
  const rows = [
    ["Last sync run", health?.lastSync?.runId ?? "Not yet"],
    ["Last sync started", date(health?.lastSync?.startedAt)],
    ["Last sync outcome", health?.lastSync?.outcome ?? "Not yet"],
    ["Next scheduled sync", date(health?.nextSync)],
    ["Schedule", health?.cronExpression ?? "Not available"],
    ["Worker version", health?.version ?? "Not available"],
  ]

  return (
    <Box background="neutral0" padding={6} hasRadius shadow="tableShadow">
      <Flex justifyContent="space-between" gap={4} paddingBottom={5}>
        <Typography tag="h2" variant="delta">
          Sync worker
        </Typography>
        <Button
          variant="secondary"
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh health
        </Button>
      </Flex>
      {loading ? (
        <Loader>Checking worker</Loader>
      ) : error ? (
        <Alert
          variant="danger"
          title="Health check failed"
          closeLabel="Retry"
          onClose={() => setRevision((value) => value + 1)}
        >
          Couldn’t read worker health. Try Refresh health.
        </Alert>
      ) : (
        <Flex direction="column" alignItems="stretch" gap={5}>
          <Flex gap={3}>
            <Badge>{status}</Badge>
            <Typography textColor="neutral600">
              {status === "Running"
                ? "An import is in progress."
                : status === "Idle"
                  ? "Ready for the next scheduled import."
                  : "The worker could not be reached."}
            </Typography>
          </Flex>
          {status === "Offline" && (
            <Alert
              variant="warning"
              title="Worker offline"
              closeLabel="Refresh health"
              onClose={() => setRevision((value) => value + 1)}
            >
              Check the worker service and its configured health address.
            </Alert>
          )}
          <Box tag="dl">
            {rows.map(([label, value]) => (
              <Box
                key={label}
                paddingTop={3}
                paddingBottom={3}
                borderColor="neutral200"
                style={{ borderBottomWidth: 1, borderBottomStyle: "solid" }}
              >
                <Typography tag="dt" variant="sigma" textColor="neutral600">
                  {label}
                </Typography>
                <Typography
                  tag="dd"
                  paddingTop={2}
                  textColor="neutral800"
                  style={{ overflowWrap: "anywhere" }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Flex>
      )}
    </Box>
  )
}
