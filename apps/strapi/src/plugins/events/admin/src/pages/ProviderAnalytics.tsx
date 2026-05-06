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
import { useEffect, useState } from "react"

interface CredentialRow {
  documentId: string
  label: string
  provider: string
  scope: string
  isActive: boolean
  lastSyncAt: string | null
  lastSyncStatus: "ok" | "partial" | "error" | null
  lastErrorMessage: string | null
  libraries: { name: string; entityRef: string }[]
}

export function ProviderAnalytics() {
  const [rows, setRows] = useState<CredentialRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/events/admin/credentials", {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    })
      .then((r) => r.json())
      .then((res: CredentialRow[]) => {
        setRows(Array.isArray(res) ? res : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function syncStatusColor(
    row: CredentialRow
  ): "success" | "warning" | "danger" | "neutral" {
    if (!row.isActive) return "neutral"
    if (row.lastSyncStatus === "ok") return "success"
    if (row.lastSyncStatus === "partial") return "warning"
    if (row.lastSyncStatus === "error") return "danger"

    return "neutral"
  }

  function syncStatusLabel(row: CredentialRow): string {
    if (!row.isActive) return "inactive"
    if (!row.lastSyncStatus) return "pending"

    return row.lastSyncStatus
  }

  return (
    <Box padding={8} background="neutral100">
      <Flex justifyContent="space-between" alignItems="center" marginBottom={6}>
        <Typography variant="alpha">Event Credentials</Typography>
        <Button variant="default" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </Flex>

      {loading ? (
        <Typography>Loading…</Typography>
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
