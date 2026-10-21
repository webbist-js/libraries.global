import {
  Alert,
  Box,
  Button,
  Dialog,
  Flex,
  Loader,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"
import { useFetchClient } from "@strapi/strapi/admin"
import { useEffect, useRef, useState } from "react"

type PendingEvent = {
  documentId: string
  title: string
  startTime?: string
  libraryEntityRef?: string
  sourceProvider?: string
  url?: string
}
type Queue = {
  data: PendingEvent[]
  meta: { total: number; page: number; pageSize: number }
}

export function PendingReviewList({
  onCountChange,
  canReview = false,
}: {
  onCountChange?: (count: number) => void
  canReview?: boolean
}) {
  const { get, put } = useFetchClient()
  const [result, setResult] = useState<Queue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [discard, setDiscard] = useState<PendingEvent | null>(null)
  const notify = useRef(onCountChange)
  notify.current = onCountChange
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    get<Queue>(`/events/admin/pending-review?page=${page}&limit=20`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (controller.signal.aborted) return
        if (!data.data.length && page > 1) {
          setPage((value) => value - 1)

          return
        }
        setResult(data)
        notify.current?.(data.meta.total)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("The event queue couldn't be loaded. Try Refresh queue.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [get, page, revision])
  const decide = async (event: PendingEvent, action: "approve" | "discard") => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await put(`/events/admin/pending-review/${event.documentId}`, { action })
      setDiscard(null)
      setRevision((value) => value + 1)
    } catch {
      setError(
        "The review action couldn't be saved. The event is still in the queue; try again."
      )
    } finally {
      setBusy(false)
    }
  }
  const rows = result?.data ?? []
  const pages = Math.max(1, Math.ceil((result?.meta.total ?? 0) / 20))

  return (
    <Flex direction="column" alignItems="stretch" gap={5}>
      <Flex justifyContent="space-between" gap={4} wrap="wrap">
        <Box>
          <Typography tag="h2" variant="delta">
            Events awaiting review
          </Typography>
          <Typography tag="p" textColor="neutral600" paddingTop={2}>
            Check the source and matched library before publishing.
          </Typography>
        </Box>
        <Button
          variant="secondary"
          disabled={loading || busy}
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh queue
        </Button>
      </Flex>
      {error && (
        <Alert
          variant="danger"
          title="Queue unavailable"
          closeLabel="Dismiss"
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      {loading ? (
        <Loader>Loading event queue</Loader>
      ) : rows.length === 0 && !error ? (
        <Box background="neutral0" hasRadius padding={8}>
          <Typography tag="h3" variant="delta">
            All caught up
          </Typography>
          <Typography tag="p" textColor="neutral600" paddingTop={3}>
            No imported events are waiting for review.
          </Typography>
        </Box>
      ) : (
        <Box style={{ overflowX: "auto" }}>
          <Table
            colCount={canReview ? 5 : 4}
            rowCount={rows.length}
            aria-label="Events awaiting review"
          >
            <Thead>
              <Tr>
                {[
                  "Event",
                  "Library",
                  "Starts",
                  "Source",
                  ...(canReview ? ["Actions"] : []),
                ].map((label) => (
                  <Th key={label}>
                    <Typography variant="sigma">{label}</Typography>
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((event) => (
                <Tr key={event.documentId}>
                  <Td>
                    <Typography>{event.title}</Typography>
                    {event.url && /^https?:\/\//i.test(event.url) && (
                      <Typography tag="p" paddingTop={2}>
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View source
                        </a>
                      </Typography>
                    )}
                  </Td>
                  <Td>
                    <Typography>
                      {event.libraryEntityRef ?? "No library matched"}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography textColor="neutral600">
                      {event.startTime
                        ? new Date(event.startTime).toLocaleString()
                        : "—"}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography>{event.sourceProvider ?? "—"}</Typography>
                  </Td>
                  {canReview && (
                    <Td>
                      <Flex gap={2}>
                        <Button
                          size="S"
                          disabled={busy}
                          onClick={() => void decide(event, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="S"
                          variant="danger-light"
                          disabled={busy}
                          onClick={() => setDiscard(event)}
                        >
                          Discard
                        </Button>
                      </Flex>
                    </Td>
                  )}
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
            disabled={loading || busy || page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <Typography textColor="neutral600">
            Page {page} of {pages}
          </Typography>
          <Button
            variant="secondary"
            disabled={loading || busy || page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </Flex>
      )}
      <Dialog.Root
        open={!!discard}
        onOpenChange={(open) => {
          if (!open && !busy) setDiscard(null)
        }}
      >
        <Dialog.Content>
          <Dialog.Header>Discard imported event</Dialog.Header>
          <Dialog.Body>
            <Box>
              <Dialog.Description>
                Remove “{discard?.title}” from the review queue? This deletes
                the imported event.
              </Dialog.Description>
              {error && (
                <Typography
                  tag="p"
                  role="alert"
                  textColor="danger600"
                  paddingTop={3}
                >
                  {error}
                </Typography>
              )}
            </Box>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button
                variant="tertiary"
                disabled={busy}
                onClick={() => setDiscard(null)}
              >
                Cancel
              </Button>
            </Dialog.Cancel>
            <Button
              variant="danger"
              loading={busy}
              disabled={busy}
              onClick={() => {
                if (discard) void decide(discard, "discard")
              }}
            >
              Discard event
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  )
}
