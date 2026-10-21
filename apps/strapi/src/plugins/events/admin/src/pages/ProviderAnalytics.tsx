import {
  Box,
  Button,
  Flex,
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

interface CredentialRow {
  documentId: string
  label: string
  provider: string
  scope: string
  status: "draft" | "pending" | "active" | "paused"
  lastSyncAt: string | null
  lastSyncStatus: "ok" | "partial" | "error" | null
  lastErrorMessage: string | null
  libraries: { name: string; entityRef: string }[]
}

export function ProviderAnalytics() {
  const { get } = useFetchClient()
  const [rows, setRows] = useState<CredentialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let current = true
    // Reset the external request state when its identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(false)
    get("/events/admin/credentials")
      .then(({ data }) => {
        if (!Array.isArray(data))
          throw new Error("Invalid credentials response")
        if (current) setRows(data as CredentialRow[])
      })
      .catch(() => {
        if (current) setError(true)
      })
      .finally(() => {
        if (current) setLoading(false)
      })

    return () => {
      current = false
    }
  }, [get, revision])

  function syncStatusColor(
    row: CredentialRow
  ): "success" | "warning" | "danger" | "neutral" {
    if (row.status !== "active") return "neutral"
    if (row.lastSyncStatus === "ok") return "success"
    if (row.lastSyncStatus === "partial") return "warning"
    if (row.lastSyncStatus === "error") return "danger"

    return "neutral"
  }

  function syncStatusLabel(row: CredentialRow): string {
    if (row.status === "paused") return "paused"
    if (row.status === "pending") return "waiting for review"
    if (row.status === "draft") return "draft"
    if (!row.lastSyncStatus) return "not synced yet"

    return row.lastSyncStatus
  }

  return (
    <Box style={{ overflowX: "auto" }}>
      <Flex justifyContent="space-between" alignItems="center" marginBottom={6}>
        <Typography tag="h2" variant="delta">
          Provider analytics
        </Typography>
        <Button
          variant="default"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
        >
          Refresh
        </Button>
      </Flex>

      {error ? (
        <Typography role="alert" textColor="danger600">
          Couldn’t load provider analytics. Try Refresh.
        </Typography>
      ) : loading ? (
        <Typography>Loading…</Typography>
      ) : rows.length === 0 ? (
        <Typography textColor="neutral600">
          No event credentials yet. Add a feed in Credentials to start syncing
          events.
        </Typography>
      ) : (
        <Table colCount={5} rowCount={rows.length}>
          <Thead>
            <Tr>
              <Th>
                <Typography variant="sigma">Label</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Provider</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Libraries</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Sync status</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Last sync</Typography>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row) => (
              <Tr key={row.documentId}>
                <Td>
                  <Typography variant="omega" fontWeight="semiBold">
                    {row.label}
                  </Typography>
                  <Typography variant="pi" textColor="neutral500">
                    {row.scope}
                  </Typography>
                </Td>
                <Td>
                  <Typography variant="omega" textColor="neutral600">
                    {row.provider}
                  </Typography>
                </Td>
                <Td>
                  <Typography variant="omega" textColor="neutral600">
                    {row.libraries?.length
                      ? row.libraries.map((l) => l.name).join(", ")
                      : "—"}
                  </Typography>
                </Td>
                <Td>
                  <Typography
                    variant="pi"
                    textColor={`${syncStatusColor(row)}600`}
                    fontWeight="semiBold"
                    textTransform="uppercase"
                  >
                    {syncStatusLabel(row)}
                  </Typography>
                  {row.lastErrorMessage && (
                    <Typography variant="pi" textColor="danger600">
                      {row.lastErrorMessage}
                    </Typography>
                  )}
                </Td>
                <Td>
                  <Typography variant="omega" textColor="neutral600">
                    {row.lastSyncAt
                      ? new Date(row.lastSyncAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </Typography>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Box>
  )
}
