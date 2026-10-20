import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  Loader,
  Modal,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"
import { useFetchClient } from "@strapi/strapi/admin"
import { useEffect, useState } from "react"

import { ImportRunDetail, type RunRecord } from "./ImportRunDetail"

type Runs = {
  data: RunRecord[]
  meta: { total: number; page: number; pageSize: number }
}
const date = (value?: string) =>
  value ? new Date(value).toLocaleString() : "—"

export function ImportRunList({ canManage = false }: { canManage?: boolean }) {
  const { get, post } = useFetchClient()
  const [result, setResult] = useState<Runs | null>(null)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [queuing, setQueuing] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  )
  const [open, setOpen] = useState<RunRecord | null>(null)
  const refreshAfterRun = () => setRevision((value) => value + 1)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    setLoading(true)
    setError(false)
    get<Runs>(`/events/admin/runs?page=${page}&limit=20`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (controller.signal.aborted) return
        setResult(data)
        if (data.data.some((run) => run.status === "running"))
          timer = setTimeout(refreshAfterRun, 30000)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [get, page, revision])
  const trigger = async () => {
    setQueuing(true)
    setMessage(null)
    try {
      await post("/events/admin/sync", {})
      setMessage({
        ok: true,
        text: "Sync queued. The worker usually picks it up within two minutes.",
      })
      setRevision((value) => value + 1)
    } catch {
      setMessage({ ok: false, text: "Couldn’t queue a sync. Try again." })
    } finally {
      setQueuing(false)
    }
  }
  const rows = result?.data ?? []
  const pages = Math.max(1, Math.ceil((result?.meta.total ?? 0) / 20))

  return (
    <Flex direction="column" alignItems="stretch" gap={5}>
      <Flex justifyContent="space-between" wrap="wrap" gap={3}>
        <Box>
          <Typography tag="h2" variant="delta">
            Import history
          </Typography>
          <Typography tag="p" textColor="neutral600" paddingTop={2}>
            Inspect completed imports and follow running jobs.
          </Typography>
        </Box>
        <Flex gap={2}>
          <Button
            variant="tertiary"
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            Refresh imports
          </Button>
          {canManage && (
            <Button
              loading={queuing}
              disabled={queuing}
              onClick={() => void trigger()}
            >
              Queue sync
            </Button>
          )}
        </Flex>
      </Flex>
      {message && (
        <Typography
          role={message.ok ? "status" : "alert"}
          textColor={message.ok ? "success600" : "danger600"}
        >
          {message.text}
        </Typography>
      )}
      {error && (
        <Alert
          title="Couldn’t load imports"
          variant="danger"
          closeLabel="Retry"
          onClose={() => setRevision((value) => value + 1)}
        >
          Try Refresh imports.
        </Alert>
      )}
      {loading ? (
        <Loader>Loading imports</Loader>
      ) : rows.length === 0 && !error ? (
        <Typography textColor="neutral600">
          No imports yet. Runs will appear after the worker connects.
        </Typography>
      ) : (
        <Box style={{ overflowX: "auto" }}>
          <Table colCount={6} rowCount={rows.length} aria-label="Import runs">
            <Thead>
              <Tr>
                {[
                  "Run",
                  "Status",
                  "Started",
                  "Finished",
                  "Created / updated",
                  "Details",
                ].map((label) => (
                  <Th key={label}>
                    <Typography variant="sigma">{label}</Typography>
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((run) => (
                <Tr key={run.runId}>
                  <Td>
                    <Typography>{run.runId}</Typography>
                    <Typography tag="p" variant="pi" textColor="neutral600">
                      {run.triggeredBy ?? "Scheduled"}
                    </Typography>
                  </Td>
                  <Td>
                    <Badge>{run.status}</Badge>
                  </Td>
                  <Td>
                    <Typography textColor="neutral600">
                      {date(run.startedAt)}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography textColor="neutral600">
                      {date(run.completedAt ?? run.finishedAt)}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography>
                      {run.eventsCreated ?? run.stats?.created ?? 0} /{" "}
                      {run.eventsUpdated ?? run.stats?.updated ?? 0}
                    </Typography>
                  </Td>
                  <Td>
                    <Button
                      variant="tertiary"
                      size="S"
                      onClick={() => setOpen(run)}
                    >
                      View run
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
      {pages > 1 && (
        <Flex justifyContent="space-between" gap={4}>
          <Button
            variant="secondary"
            disabled={loading || page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <Typography textColor="neutral600">
            Page {page} of {pages}
          </Typography>
          <Button
            variant="secondary"
            disabled={loading || page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </Flex>
      )}
      <Modal.Root
        open={!!open}
        onOpenChange={(open) => {
          if (!open) setOpen(null)
        }}
      >
        {open && (
          <Modal.Content aria-describedby={undefined}>
            <Modal.Header>
              <Modal.Title>Import {open.runId}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <ImportRunDetail run={open} />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onClick={() => setOpen(null)}>
                Close
              </Button>
            </Modal.Footer>
          </Modal.Content>
        )}
      </Modal.Root>
    </Flex>
  )
}
