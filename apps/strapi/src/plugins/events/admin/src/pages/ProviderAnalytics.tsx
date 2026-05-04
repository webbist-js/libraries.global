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

interface ProviderRow {
  libraryEntityRef: string
  providerType: string
  status: string
  lastImportAt: string | null
  lastImportCount: number | null
}

export function ProviderAnalytics() {
  const [rows, setRows] = useState<ProviderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(
      "/api/event-providers?pagination[limit]=100&sort=libraryEntityRef:asc",
      {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    )
      .then((r) => r.json())
      .then((res: { data?: ProviderRow[] }) => {
        setRows(res.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function statusColor(
    status: string
  ): "success" | "warning" | "danger" | "neutral" {
    if (status === "active") return "success"
    if (status === "pending") return "warning"
    if (status === "paused") return "neutral"

    return "danger"
  }

  return (
    <Box padding={8} background="neutral100">
      <Flex justifyContent="space-between" alignItems="center" marginBottom={6}>
        <Typography variant="alpha">Event Provider Analytics</Typography>
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
                <Typography variant="sigma">Library Ref</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Provider</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Status</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Last Import</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Events Imported</Typography>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row) => (
              <Tr key={row.libraryEntityRef}>
                <Td>
                  <Typography variant="omega" fontWeight="semiBold">
                    {row.libraryEntityRef}
                  </Typography>
                </Td>
                <Td>
                  <Typography variant="omega" textColor="neutral600">
                    {row.providerType}
                  </Typography>
                </Td>
                <Td>
                  <Typography
                    variant="pi"
                    textColor={`${statusColor(row.status)}600`}
                    fontWeight="semiBold"
                    textTransform="uppercase"
                  >
                    {row.status}
                  </Typography>
                </Td>
                <Td>
                  <Typography variant="omega" textColor="neutral600">
                    {row.lastImportAt
                      ? new Date(row.lastImportAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </Typography>
                </Td>
                <Td>
                  <Typography variant="omega" textColor="neutral600">
                    {row.lastImportCount ?? "—"}
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
