import {
  Alert,
  Box,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"

import { humanise, renderValue, type Submission } from "./submissionMeta"

/** Keys in `fields` that aren't library fields. */
const META_KEYS = new Set(["kind", "previous"])

/**
 * Review panel for a record edit from the Index editor: a claimant's
 * `library_edit` or a `correction` with `fields.kind: "record"`. Shows each
 * changed field as current → proposed. Approval writes the proposed values
 * to the library and publishes it.
 */
export function RecordChangesPanel({ sub }: { sub: Submission }) {
  const fields = sub.fields ?? {}
  const previous = (fields.previous ?? {}) as Record<string, unknown>
  const changes = Object.entries(fields).filter(([k]) => !META_KEYS.has(k))

  if (changes.length === 0)
    return (
      <Typography textColor="neutral500">
        No field changes in this submission.
      </Typography>
    )

  return (
    <>
      <Box paddingBottom={4}>
        <Alert
          variant="default"
          title={`${changes.length} field${changes.length === 1 ? "" : "s"} changed${sub.submissionType === "correction" ? " · from a contributor without a claim" : " · from a claimant"}`}
          closeLabel="Dismiss"
          onClose={() => {}}
        >
          Approving writes the proposed values to the library record and
          publishes it. Fields not listed here are left as they are.
        </Alert>
      </Box>
      <Table colCount={3} rowCount={changes.length + 1}>
        <Thead>
          <Tr>
            <Th>
              <Typography variant="sigma">Field</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">Current</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">Proposed</Typography>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {changes.map(([key, value]) => {
            const before =
              key in previous ? renderValue(previous[key]).text : "—"
            const after = renderValue(value).text

            return (
              <Tr key={key}>
                <Td>
                  <Typography fontWeight="semiBold">{humanise(key)}</Typography>
                </Td>
                <Td>
                  <Typography
                    textColor="neutral500"
                    style={{
                      textDecoration:
                        key in previous && before !== "—"
                          ? "line-through"
                          : "none",
                      wordBreak: "break-word",
                    }}
                  >
                    {before}
                  </Typography>
                </Td>
                <Td>
                  <Typography
                    textColor="success700"
                    style={{ wordBreak: "break-word" }}
                  >
                    {after}
                  </Typography>
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>
    </>
  )
}
