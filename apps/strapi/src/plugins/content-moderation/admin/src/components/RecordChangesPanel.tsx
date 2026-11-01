import {
  Alert,
  Box,
  Flex,
  Tag,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"

import { humanise, renderValue, type Submission } from "./submissionMeta"
import { TimetableReviewPanel } from "./TimetableReviewPanel"
import { PluginTable } from "../../../../../admin/components/PluginUI"

/** Keys in `fields` that describe the submission, not library fields. */
const META_KEYS = new Set([
  "kind",
  "previous",
  "previousHash",
  "category",
  "libraryName",
  "suggestedOptions",
])

const RELATIONS = new Set(["accessibility", "amenities", "services"])

const DAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

type Day = {
  day?: string
  enabled?: boolean
  timeframes?: { startTime?: string; endTime?: string; staffing?: string }[]
}

/** One line per day, e.g. "Mon 09:00–13:00, 14:00–17:00 (volunteer)". */
function hoursLines(v: unknown): string[] | null {
  const days = (v as { days?: Day[] } | null)?.days
  if (!Array.isArray(days)) return null

  return days.map((d) => {
    const label = DAY_SHORT[d.day ?? ""] ?? d.day ?? "?"
    const frames = d.enabled ? (d.timeframes ?? []) : []
    if (frames.length === 0) return `${label} closed`

    return `${label} ${frames
      .map(
        (t) =>
          `${t.startTime}–${t.endTime}${t.staffing && t.staffing !== "staffed" ? ` (${t.staffing.replace("_", " ")})` : ""}`
      )
      .join(", ")}`
  })
}

function Lines({
  lines,
  tone,
  strike,
}: {
  lines: string[]
  tone: "neutral500" | "success700"
  strike?: boolean
}) {
  return (
    <Flex direction="column" alignItems="flex-start" gap={1}>
      {lines.map((line, i) => (
        <Typography
          key={i}
          textColor={tone}
          style={{
            wordBreak: "break-word",
            textDecoration: strike ? "line-through" : "none",
          }}
        >
          {line}
        </Typography>
      ))}
    </Flex>
  )
}

/**
 * Review panel for a record edit: a claimant's `library_edit` or a
 * `correction` with `fields.kind: "record"`. Current values come from the
 * library itself (loaded by the server), never from the contributor.
 * Approval writes the proposed values and publishes the library.
 */
export function RecordChangesPanel({ sub }: { sub: Submission }) {
  const fields = sub.fields ?? {}
  const current = sub.review?.current
  const previous = (fields.previous ?? {}) as Record<string, unknown>
  const names = sub.review?.names ?? {}
  const nameOf = (id: unknown) =>
    typeof id === "string" ? (names[id] ?? `Unknown option (${id})`) : "?"
  const changes = Object.entries(fields).filter(([k]) => !META_KEYS.has(k))
  const suggested = Object.entries(
    (fields.suggestedOptions ?? {}) as Record<string, unknown>
  ).filter(([, v]) => Array.isArray(v) && v.length > 0) as [string, string[]][]

  if (changes.length === 0 && suggested.length === 0)
    return (
      <Typography textColor="neutral500">
        No field changes in this submission.
      </Typography>
    )

  const before = (key: string): string[] => {
    const source = current ?? previous
    if (!(key in source)) return ["—"]
    const v = source[key]
    if (key === "homeLibrary")
      return [typeof v === "string" ? nameOf(v) : "None"]
    if (RELATIONS.has(key))
      return Array.isArray(v) && v.length
        ? [v.map(nameOf).join(", ")]
        : ["None"]

    return hoursLines(v) ?? [renderValue(v).text]
  }

  const after = (key: string, v: unknown): string[] => {
    if (key === "homeLibrary")
      return [typeof v === "string" && v ? nameOf(v) : "None"]
    if (RELATIONS.has(key)) {
      if (Array.isArray(v))
        return [v.length ? v.map(nameOf).join(", ") : "None"]
      const { connect, disconnect } = (v ?? {}) as Record<string, unknown>

      return [
        ...(Array.isArray(connect)
          ? connect.map((id) => `+ Add ${nameOf(id)}`)
          : []),
        ...(Array.isArray(disconnect)
          ? disconnect.map((id) => `− Remove ${nameOf(id)}`)
          : []),
      ]
    }

    return hoursLines(v) ?? [renderValue(v).text]
  }

  const rows = changes.length + suggested.length
  const from =
    sub.submissionType === "correction"
      ? " · from a contributor without a claim"
      : " · from a claimant"

  return (
    <>
      {Object.prototype.hasOwnProperty.call(fields, "mobileTimetable") && (
        <TimetableReviewPanel sub={sub} />
      )}
      <Box paddingBottom={4}>
        <Alert
          variant="default"
          title={`${rows} change${rows === 1 ? "" : "s"}${from}${typeof fields.category === "string" ? ` · ${fields.category}` : ""}`}
          closeLabel="Dismiss"
          onClose={() => {}}
        >
          Approving writes the proposed values to the library record and
          publishes it. Fields not listed here are left as they are.
          {suggested.length > 0
            ? " A suggested name that matches an existing option is linked. A new one is saved as a draft for the editorial board’s monthly review."
            : ""}
          {current ? "" : " The current values shown are the contributor’s."}
        </Alert>
      </Box>
      <PluginTable colCount={3} rowCount={rows + 1}>
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
          {changes
            .filter(([key]) => key !== "mobileTimetable")
            .map(([key, value]) => {
              const was = before(key)

              return (
                <Tr key={key}>
                  <Td>
                    <Typography fontWeight="semiBold">
                      {humanise(key)}
                    </Typography>
                  </Td>
                  <Td>
                    <Lines
                      lines={was}
                      strike={!RELATIONS.has(key) && was[0] !== "—"}
                      tone="neutral500"
                    />
                  </Td>
                  <Td>
                    <Lines lines={after(key, value)} tone="success700" />
                  </Td>
                </Tr>
              )
            })}
          {suggested.map(([key, list]) => (
            <Tr key={`new-${key}`}>
              <Td>
                <Typography fontWeight="semiBold">
                  New {humanise(key).toLowerCase()} option
                </Typography>
              </Td>
              <Td>
                <Typography textColor="neutral500">
                  Not in the list yet
                </Typography>
              </Td>
              <Td>
                <Flex gap={2} wrap="wrap">
                  {list.map((name) => (
                    <Tag key={name} icon={null}>
                      {name}
                    </Tag>
                  ))}
                </Flex>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </PluginTable>
    </>
  )
}
