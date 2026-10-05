import {
  Alert,
  Badge,
  Box,
  Button,
  EmptyStateLayout,
  Field,
  Flex,
  Loader,
  Modal,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  Textarea,
  TextInput,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"
import { Check, Cross } from "@strapi/icons"
import { EmptyDocuments } from "@strapi/icons/symbols"
import { useFetchClient, useNotification } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

import { relativeTime } from "./submissionMeta"

export type Suggestion = {
  documentId: string
  name: string
  optionKey: "accessibility" | "amenities" | "services" | "library_types"
  status: "open" | "reviewing" | "planned" | "accepted" | "declined" | "removed"
  requests: number
  votes: number
  libraries: { documentId: string; name: string }[]
  /** Accepted only: libraries the option could not be linked to (follow up by hand). */
  unlinkedLibraries?: UnlinkedLibrary[]
  description?: string | null
  suggestedByName?: string | null
  createdAt?: string
  decidedAt?: string | null
  decidedBy?: string | null
  decisionNote?: string | null
}

export type UnlinkedLibrary = {
  documentId: string
  name: string
  reason: "not_published" | "not_found"
}

const LIST_LABEL: Record<Suggestion["optionKey"], string> = {
  accessibility: "Accessibility",
  amenities: "Amenities",
  services: "Services",
  library_types: "Library types",
}

/** New, under review or planned: the board hasn't decided yet, and
 * contributors can still vote. The richer New/Under review/Planned/Added/
 * Not adding board lives on the site at /contribute/moderation/suggestions;
 * this admin queue keeps the simpler open/accepted/declined split and
 * treats all three as "open" for the tab badge and this filter. */
const UNDECIDED = new Set<Suggestion["status"]>([
  "open",
  "reviewing",
  "planned",
])

const UNLINKED_REASON: Record<UnlinkedLibrary["reason"], string> = {
  not_published: "not published — publish it, then add the option",
  not_found: "no longer exists",
}

/** "Library A (not published — …), Library B (no longer exists)". */
const describeUnlinked = (list: UnlinkedLibrary[]) =>
  list
    .map((l) => `${l.name} (${UNLINKED_REASON[l.reason] ?? l.reason})`)
    .join(", ")

type Deciding = { suggestion: Suggestion; decision: "accept" | "decline" }

/** Accept (with tidied wording) or decline one suggestion. */
function DecisionModal({
  deciding,
  onClose,
  onDone,
}: {
  deciding: Deciding | null
  onClose: () => void
  onDone: () => void
}) {
  const { put } = useFetchClient()
  const { toggleNotification } = useNotification()
  const [name, setName] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(deciding?.suggestion.name ?? "")
    setNote("")
  }, [deciding])

  if (!deciding) return null
  const { suggestion, decision } = deciding
  const accept = decision === "accept"
  const libraries = suggestion.libraries.length

  const save = async () => {
    setSaving(true)
    try {
      const res = await put(
        `/content-moderation/option-suggestions/${suggestion.documentId}`,
        {
          decision,
          name: accept ? name : undefined,
          note,
        }
      )
      const data = (res as { data?: { data?: Suggestion } })?.data?.data
      const unlinked: UnlinkedLibrary[] = Array.isArray(data?.unlinkedLibraries)
        ? (data.unlinkedLibraries ?? [])
        : []
      const linked = libraries - unlinked.length
      const libraryTypes = suggestion.optionKey === "library_types"
      toggleNotification({
        type: "success",
        message: accept
          ? libraryTypes
            ? `Marked “${data?.name ?? (name.trim() || suggestion.name)}” as added.`
            : `Added “${name.trim() || suggestion.name}” to ${LIST_LABEL[suggestion.optionKey]} and linked ${linked} ${linked === 1 ? "library" : "libraries"}.`
          : "Declined. It won’t be suggested again.",
      })
      if (accept && !libraryTypes && unlinked.length > 0)
        toggleNotification({
          type: "warning",
          message: `Not linked: ${describeUnlinked(unlinked)}. The suggestion stays listed under Accepted with this follow-up.`,
        })
      onDone()
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "The decision couldn't be saved."
      toggleNotification({ type: "danger", message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>
            {accept ? "Accept" : "Decline"} “{suggestion.name}”
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Typography textColor="neutral600">
              {accept
                ? suggestion.optionKey === "library_types"
                  ? "Accept only works once the type is in the schema; until then, mark it planned. It creates no option and links no libraries — the enum itself is changed by hand."
                  : `This adds it to the ${LIST_LABEL[suggestion.optionKey].toLowerCase()} list (or reuses an option with the same name) and links it to the ${libraries} ${libraries === 1 ? "library" : "libraries"} that asked for it.`
                : "Declined names stay declined: later requests for the same name are not counted."}
            </Typography>
            {accept ? (
              <Field.Root
                name="name"
                hint="Tidy the wording if you need to. This is how it appears on library pages."
              >
                <Field.Label>Name</Field.Label>
                <TextInput
                  value={name}
                  onChange={(e: any) => setName(e.target.value)}
                />
                <Field.Hint />
              </Field.Root>
            ) : null}
            <Field.Root
              name="note"
              required={!accept}
              hint={
                accept
                  ? "Kept with the decision for the board’s records. Not shown publicly."
                  : "Shown publicly with the suggestion."
              }
            >
              <Field.Label>Note</Field.Label>
              <Textarea
                value={note}
                onChange={(e: any) => setNote(e.target.value)}
              />
              <Field.Hint />
            </Field.Root>
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cancel</Button>
          </Modal.Close>
          <Button
            variant={accept ? "success" : "danger-light"}
            startIcon={accept ? <Check /> : <Cross />}
            loading={saving}
            disabled={accept ? !name.trim() : !note.trim()}
            onClick={() => void save()}
          >
            {accept
              ? suggestion.optionKey === "library_types"
                ? "Mark as added"
                : "Accept and link"
              : "Decline"}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}

/**
 * The editorial board's tally of options contributors asked for, with the
 * votes they've had in the Contribute hub. Accepting adds the option and
 * links every library that asked for it.
 */
export function SuggestionsPanel({
  onOpenCount,
}: {
  onOpenCount: (n: number) => void
}) {
  const { get } = useFetchClient()
  const [rows, setRows] = useState<Suggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Suggestion["status"]>("open")
  const [list, setList] = useState<"all" | Suggestion["optionKey"]>("all")
  const [deciding, setDeciding] = useState<Deciding | null>(null)

  // State is only set from the response callbacks, never synchronously in
  // the effect, which is what the React compiler's effect rule requires.
  const load = useCallback(
    () =>
      get("/content-moderation/option-suggestions").then(
        ({ data }) => {
          const items = ((data as { data?: Suggestion[] })?.data ??
            []) as Suggestion[]
          setError(null)
          setRows(items)
          onOpenCount(items.filter((s) => UNDECIDED.has(s.status)).length)
        },
        (err: unknown) => {
          setError("Suggestions couldn't be loaded.")
          console.error(err)
        }
      ),
    [get, onOpenCount]
  )

  useEffect(() => {
    void load()
  }, [load])

  const shown = (rows ?? []).filter(
    (s) =>
      (status === "open" ? UNDECIDED.has(s.status) : s.status === status) &&
      (list === "all" || s.optionKey === list)
  )
  const open = (rows ?? []).filter((s) => UNDECIDED.has(s.status))

  return (
    <Box background="neutral0" padding={6} hasRadius shadow="tableShadow">
      <Flex direction="column" alignItems="stretch" gap={4}>
        <Flex
          justifyContent="space-between"
          alignItems="flex-end"
          gap={4}
          wrap="wrap"
        >
          <Box>
            <Typography variant="delta" tag="h2">
              Suggested additions
            </Typography>
            <Typography variant="omega" textColor="neutral600">
              Options contributors asked for in approved corrections, with their
              votes from the Contribute hub.{" "}
              {open.length > 0
                ? `${open.length} open, ${open.reduce((n, s) => n + s.votes, 0)} votes so far.`
                : ""}
            </Typography>
          </Box>
          <Flex gap={2}>
            <SingleSelect
              aria-label="Status"
              size="S"
              value={status}
              onChange={(v: string | number) =>
                setStatus(v as Suggestion["status"])
              }
            >
              <SingleSelectOption value="open">Open</SingleSelectOption>
              <SingleSelectOption value="accepted">Accepted</SingleSelectOption>
              <SingleSelectOption value="declined">Declined</SingleSelectOption>
            </SingleSelect>
            <SingleSelect
              aria-label="List"
              size="S"
              value={list}
              onChange={(v: string | number) => setList(v as typeof list)}
            >
              <SingleSelectOption value="all">All lists</SingleSelectOption>
              <SingleSelectOption value="accessibility">
                Accessibility
              </SingleSelectOption>
              <SingleSelectOption value="services">Services</SingleSelectOption>
              <SingleSelectOption value="amenities">
                Amenities
              </SingleSelectOption>
              <SingleSelectOption value="library_types">
                Library types
              </SingleSelectOption>
            </SingleSelect>
          </Flex>
        </Flex>

        {error ? (
          <Alert
            variant="danger"
            title="Couldn't load"
            closeLabel="Dismiss"
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        ) : rows === null ? (
          <Flex justifyContent="center" padding={8}>
            <Loader>Loading suggestions…</Loader>
          </Flex>
        ) : shown.length === 0 ? (
          <EmptyStateLayout
            icon={<EmptyDocuments width="16rem" />}
            content={
              status === "open"
                ? "No open suggestions. They appear here when a correction that names a new option is approved."
                : `No ${status} suggestions yet.`
            }
          />
        ) : (
          <Table
            colCount={status === "open" ? 7 : 6}
            rowCount={shown.length + 1}
          >
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">Name</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">List</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Requests</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Votes</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Libraries</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    {status === "open" ? "First asked" : "Decided"}
                  </Typography>
                </Th>
                {status === "open" ? (
                  <Th>
                    <Typography variant="sigma">Decision</Typography>
                  </Th>
                ) : null}
              </Tr>
            </Thead>
            <Tbody>
              {shown.map((s) => (
                <Tr key={s.documentId}>
                  <Td>
                    <Typography fontWeight="semiBold">{s.name}</Typography>
                  </Td>
                  <Td>
                    <Badge>{LIST_LABEL[s.optionKey]}</Badge>
                  </Td>
                  <Td>
                    <Typography>{s.requests}</Typography>
                  </Td>
                  <Td>
                    <Badge active={s.votes > 0}>{s.votes}</Badge>
                  </Td>
                  <Td style={{ maxWidth: "28rem" }}>
                    <Typography textColor="neutral600" ellipsis>
                      {s.libraries.map((l) => l.name).join(", ") || "—"}
                    </Typography>
                    {s.status === "accepted" &&
                    (s.unlinkedLibraries?.length ?? 0) > 0 ? (
                      <Box paddingTop={1}>
                        <Flex gap={1} alignItems="flex-start" wrap="wrap">
                          <Badge
                            backgroundColor="warning100"
                            textColor="warning700"
                          >
                            Follow up
                          </Badge>
                          <Typography
                            variant="pi"
                            textColor="warning700"
                            style={{ whiteSpace: "normal" }}
                          >
                            Not linked: {describeUnlinked(s.unlinkedLibraries!)}
                          </Typography>
                        </Flex>
                      </Box>
                    ) : null}
                  </Td>
                  <Td>
                    <Typography textColor="neutral600">
                      {status === "open"
                        ? relativeTime(s.createdAt)
                        : `${relativeTime(s.decidedAt ?? undefined)}${s.decidedBy ? ` · ${s.decidedBy}` : ""}`}
                    </Typography>
                  </Td>
                  {status === "open" ? (
                    <Td>
                      <Flex gap={2}>
                        <Button
                          size="S"
                          variant="success-light"
                          startIcon={<Check />}
                          onClick={() =>
                            setDeciding({ suggestion: s, decision: "accept" })
                          }
                        >
                          Accept
                        </Button>
                        <Button
                          size="S"
                          variant="danger-light"
                          startIcon={<Cross />}
                          onClick={() =>
                            setDeciding({ suggestion: s, decision: "decline" })
                          }
                        >
                          Decline
                        </Button>
                      </Flex>
                    </Td>
                  ) : null}
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Flex>
      <DecisionModal
        deciding={deciding}
        onClose={() => setDeciding(null)}
        onDone={() => {
          setDeciding(null)
          void load()
        }}
      />
    </Box>
  )
}
