import {
  Box,
  Flex,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"

export type RunRecord = {
  runId: string
  triggeredBy?: string
  startedAt?: string
  finishedAt?: string
  status: string
  completedAt?: string
  eventsFetched?: number
  eventsCreated?: number
  eventsUpdated?: number
  eventsUnchanged?: number
  eventsExpiredPurged?: number
  eventsPendingReview?: number
  errorCount?: number
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
  failedCredentials?: {
    credentialDocumentId: string
    label?: string
    error: string
  }[]
}
export function ImportRunDetail({ run }: { run: RunRecord }) {
  const rows = [
    ["Fetched", run.eventsFetched ?? run.stats?.fetched],
    ["Created", run.eventsCreated ?? run.stats?.created],
    ["Updated", run.eventsUpdated ?? run.stats?.updated],
    ["Unchanged", run.eventsUnchanged ?? run.stats?.unchanged],
    ["Expired", run.eventsExpiredPurged ?? run.stats?.expired],
    ["Pending review", run.eventsPendingReview ?? run.stats?.pendingReview],
    ["Errors", run.errorCount ?? run.stats?.errors],
  ]
  const providers = Object.entries(run.providerBreakdown ?? {})

  return (
    <Flex direction="column" alignItems="stretch" gap={6}>
      <Box>
        <Typography tag="h3" variant="delta" paddingBottom={3}>
          Event totals
        </Typography>
        <Box tag="dl">
          {rows.map(([label, value]) => (
            <Flex
              key={label}
              justifyContent="space-between"
              gap={3}
              paddingTop={2}
              paddingBottom={2}
            >
              <Typography tag="dt" textColor="neutral600">
                {label}
              </Typography>
              <Typography tag="dd" fontWeight="semiBold">
                {value ?? 0}
              </Typography>
            </Flex>
          ))}
        </Box>
      </Box>
      <Box>
        <Typography tag="h3" variant="delta" paddingBottom={3}>
          Providers
        </Typography>
        {!providers.length ? (
          <Typography textColor="neutral600">
            No provider breakdown was recorded.
          </Typography>
        ) : (
          <Table colCount={3} rowCount={providers.length}>
            <Thead>
              <Tr>
                {["Provider", "Fetched", "Created"].map((label) => (
                  <Th key={label}>
                    <Typography variant="sigma">{label}</Typography>
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {providers.map(([provider, entry]) => (
                <Tr key={provider}>
                  <Td>
                    <Typography>{provider}</Typography>
                  </Td>
                  <Td>
                    <Typography>{entry.fetched}</Typography>
                  </Td>
                  <Td>
                    <Typography>{entry.created}</Typography>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>
      {!!run.failedCredentials?.length && (
        <Box>
          <Typography tag="h3" variant="delta" paddingBottom={3}>
            Failed credentials
          </Typography>
          {run.failedCredentials.map((item) => (
            <Box
              key={item.credentialDocumentId}
              background="danger100"
              padding={4}
              marginBottom={3}
              hasRadius
            >
              <Typography tag="p" fontWeight="semiBold" textColor="danger700">
                {item.label ?? item.credentialDocumentId}
              </Typography>
              <Typography
                tag="p"
                textColor="neutral800"
                paddingTop={2}
                style={{ overflowWrap: "anywhere" }}
              >
                {item.error}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Flex>
  )
}
