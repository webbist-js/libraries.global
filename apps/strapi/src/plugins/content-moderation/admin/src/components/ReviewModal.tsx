import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Field,
  Flex,
  Modal,
  Status,
  Textarea,
  Typography,
} from "@strapi/design-system"
import { Check, Cross, Information } from "@strapi/icons"
import { useState } from "react"

import { RecordChangesPanel } from "./RecordChangesPanel"
import {
  detailOf,
  formatDateTime,
  STATUS_META,
  type Submission,
  summaryOf,
  TYPE_COLORS,
  TYPE_LABELS,
} from "./submissionMeta"
import {
  EventFeedPanel,
  FieldsPanel,
  KeyValueGrid,
  LibraryClaimPanel,
  Section,
  SourcesPanel,
} from "./SubmissionPanels"
import { WikiEditDiffPanel } from "./WikiEditDiffPanel"

export function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? { bg: "primary100", text: "primary600" }

  return (
    <Badge backgroundColor={c.bg} textColor={c.text}>
      {TYPE_LABELS[type] ?? type}
    </Badge>
  )
}

export function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    variant: "secondary" as const,
  }

  return (
    <Status variant={meta.variant} size="S">
      <Typography>{meta.label}</Typography>
    </Status>
  )
}

type Decision = "approved" | "rejected" | "needs_info"

const NOTE_COPY: Record<
  Exclude<Decision, "approved">,
  { label: string; hint: string; placeholder: string }
> = {
  rejected: {
    label: "Reason for rejecting",
    hint: "Shown to the contributor. Say what was wrong and, if useful, what would be accepted.",
    placeholder: "e.g. The source doesn't confirm these opening hours.",
  },
  needs_info: {
    label: "What's needed",
    hint: "Shown to the contributor, who can then add the missing detail.",
    placeholder: "e.g. Please add a link to the library's own page for this.",
  },
}

/** What the submission targets and who sent it. */
function Panel({ sub }: { sub: Submission }) {
  if (sub.submissionType === "library_claim")
    return <LibraryClaimPanel sub={sub} />
  if (sub.submissionType === "event_feed") return <EventFeedPanel sub={sub} />
  if (
    sub.submissionType === "wiki_edit" ||
    sub.submissionType === "blog_submission"
  )
    return <WikiEditDiffPanel sub={sub} />
  if (
    (sub.submissionType === "library_edit" ||
      sub.submissionType === "correction") &&
    sub.fields?.kind === "record"
  )
    return <RecordChangesPanel sub={sub} />

  return <FieldsPanel sub={sub} />
}

/**
 * The review dialog: everything a moderator needs to decide, then the
 * decision itself. Reject and Needs info ask for a note first.
 */
export function ReviewModal({
  sub,
  onClose,
  onDecide,
}: {
  sub: Submission | null
  onClose: () => void
  onDecide: (id: string, status: Decision, note?: string) => Promise<boolean>
}) {
  const [pending, setPending] = useState<Exclude<Decision, "approved"> | null>(
    null
  )
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  if (!sub) return null
  const reviewable = sub.status === "pending" || sub.status === "needs_info"

  const decide = async (status: Decision) => {
    setBusy(true)
    const ok = await onDecide(
      sub.documentId,
      status,
      pending ? note.trim() || undefined : undefined
    )
    setBusy(false)
    if (ok) {
      setPending(null)
      setNote("")
      onClose()
    }
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Flex gap={2} alignItems="center" wrap="wrap">
            <TypeBadge type={sub.submissionType} />
            <Modal.Title>{summaryOf(sub)}</Modal.Title>
            <StatusPill status={sub.status} />
          </Flex>
        </Modal.Header>
        <Modal.Body>
          <Box paddingBottom={4}>
            <KeyValueGrid
              rows={[
                {
                  label: "Submitted by",
                  value: sub.submittedByName
                    ? `${sub.submittedByName} (${sub.submittedByEmail})`
                    : sub.submittedByEmail,
                },
                { label: "Submitted", value: formatDateTime(sub.createdAt) },
                { label: "Change", value: detailOf(sub) ?? "—" },
                ...(sub.targetSlug
                  ? [{ label: "Target", value: sub.targetSlug }]
                  : []),
                ...(sub.reviewedAt
                  ? [
                      {
                        label: "Reviewed",
                        value: formatDateTime(sub.reviewedAt),
                      },
                    ]
                  : []),
              ]}
            />
          </Box>
          {(sub.note || sub.editSummary) &&
            sub.submissionType !== "wiki_edit" &&
            sub.submissionType !== "blog_submission" && (
              <Box paddingBottom={4}>
                <Alert
                  variant="default"
                  title={
                    sub.editSummary
                      ? "Contributor's summary"
                      : "Note to reviewer"
                  }
                  closeLabel="Dismiss"
                  onClose={() => {}}
                >
                  {sub.editSummary ?? sub.note}
                  {sub.editSummary && sub.note ? ` — ${sub.note}` : ""}
                </Alert>
              </Box>
            )}
          <Divider />
          <Panel sub={sub} />
          <SourcesPanel sub={sub} />
          {sub.reviewNote && (
            <Section title="Moderator note">
              <Typography>{sub.reviewNote}</Typography>
            </Section>
          )}
          {pending && (
            <Box paddingTop={4}>
              <Field.Root name="reviewNote" hint={NOTE_COPY[pending].hint}>
                <Field.Label>{NOTE_COPY[pending].label}</Field.Label>
                <Textarea
                  value={note}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setNote(e.target.value)
                  }
                  placeholder={NOTE_COPY[pending].placeholder}
                  autoFocus
                />
                <Field.Hint />
              </Field.Root>
            </Box>
          )}
        </Modal.Body>
        <Modal.Footer>
          {reviewable ? (
            pending ? (
              <>
                <Button
                  variant="tertiary"
                  onClick={() => setPending(null)}
                  disabled={busy}
                >
                  Back
                </Button>
                <Button
                  variant={pending === "rejected" ? "danger" : "default"}
                  onClick={() => void decide(pending)}
                  loading={busy}
                  startIcon={
                    pending === "rejected" ? <Cross /> : <Information />
                  }
                >
                  {pending === "rejected" ? "Reject" : "Ask for info"}
                </Button>
              </>
            ) : (
              <>
                <Modal.Close>
                  <Button variant="tertiary" disabled={busy}>
                    Close
                  </Button>
                </Modal.Close>
                <Flex gap={2}>
                  <Button
                    variant="secondary"
                    startIcon={<Information />}
                    onClick={() => setPending("needs_info")}
                    disabled={busy}
                  >
                    Needs info
                  </Button>
                  <Button
                    variant="danger-light"
                    startIcon={<Cross />}
                    onClick={() => setPending("rejected")}
                    disabled={busy}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    startIcon={<Check />}
                    onClick={() => void decide("approved")}
                    loading={busy}
                  >
                    {sub.submissionType === "library_claim"
                      ? "Approve & verify"
                      : sub.submissionType === "event_feed"
                        ? "Approve and activate"
                        : "Approve"}
                  </Button>
                </Flex>
              </>
            )
          ) : (
            <>
              <Typography variant="pi" textColor="neutral500">
                This submission is{" "}
                {STATUS_META[sub.status]?.label.toLowerCase() ?? sub.status};
                decisions are final.
              </Typography>
              <Modal.Close>
                <Button variant="tertiary">Close</Button>
              </Modal.Close>
            </>
          )}
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
