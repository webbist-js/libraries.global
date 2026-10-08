import {
  describeRepeat,
  diffTimetable,
  isStaleTimetableSuggestion,
  normalizeMobileTimetable,
  summarizeDiff,
} from "@repo/shared-data"
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

import type { Submission } from "./submissionMeta"

export function TimetableReviewPanel({ sub }: { sub: Submission }) {
  const before = normalizeMobileTimetable(
      sub.review?.current?.mobileTimetable ??
        (sub.fields?.previous as Record<string, unknown> | undefined)
          ?.mobileTimetable
    ),
    after = normalizeMobileTimetable(sub.fields?.mobileTimetable),
    diff = diffTimetable(before, after)
  const stale = isStaleTimetableSuggestion(
    sub.submissionType,
    sub.fields,
    before
  )
  const rows = [
    ...diff.stopsAdded.map((s) => ({
      label: "Stop added",
      now: "—",
      suggested: `${s.name} · ${s.where}`,
    })),
    ...diff.stopsRemoved.map((s) => ({
      label: "Stop removed",
      now: s.name,
      suggested: "No longer a stop",
    })),
    ...diff.stopsChanged.map((c) => ({
      label: `Stop changed (${c.fields.join(", ")})`,
      now: `${c.before.name} · ${c.before.where} · ${c.before.location ? `${c.before.location.lat}, ${c.before.location.lng}` : "No pin"}`,
      suggested: `${c.after.name} · ${c.after.where} · ${c.after.location ? `${c.after.location.lat}, ${c.after.location.lng}` : "No pin"}`,
    })),
    ...diff.visitsAdded.map((v) => ({
      label: "Visit added",
      now: "—",
      suggested: `${after?.stops.find((s) => s.id === v.stopId)?.name} ${v.day} ${v.arrive}–${v.depart} · ${after ? describeRepeat(v, after.cycle) : ""}`,
    })),
    ...diff.visitsRemoved.map((v) => ({
      label: "Visit removed",
      now: `${before?.stops.find((s) => s.id === v.stopId)?.name} ${v.day} ${v.arrive}–${v.depart}`,
      suggested: "No visit",
    })),
    ...diff.visitsChanged.map((c) => ({
      label: "Visit changed",
      now: `${c.before.day} ${c.before.arrive}–${c.before.depart} · ${before ? describeRepeat(c.before, before.cycle) : ""}`,
      suggested: `${c.after.day} ${c.after.arrive}–${c.after.depart} · ${after ? describeRepeat(c.after, after.cycle) : ""}`,
    })),
    ...(diff.cycleChanged
      ? [
          {
            label: "Cycle",
            now: before
              ? `${before.cycle.weeks} weeks · starts ${before.cycle.anchor}`
              : "No timetable",
            suggested: after
              ? `${after.cycle.weeks} weeks · starts ${after.cycle.anchor}`
              : "No timetable",
          },
        ]
      : []),
  ]

  return (
    <Box paddingBottom={4}>
      <Typography variant="delta">{summarizeDiff(diff)}</Typography>
      {stale && (
        <Box paddingTop={2}>
          <Alert
            closeLabel="Dismiss"
            variant="warning"
            title="The timetable changed after this was suggested"
          >
            Decline this suggestion; it cannot be applied to the current
            timetable.
          </Alert>
        </Box>
      )}
      <Table colCount={3} rowCount={rows.length + 1}>
        <Thead>
          <Tr>
            {["Change", "Current", "Proposed"].map((h) => (
              <Th key={h}>
                <Typography>{h}</Typography>
              </Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row, i) => (
            <Tr key={i}>
              <Td>
                <Typography fontWeight="bold">{row.label}</Typography>
              </Td>
              <Td>
                <Typography>{row.now}</Typography>
              </Td>
              <Td>
                <Typography textColor="success700">{row.suggested}</Typography>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  )
}
