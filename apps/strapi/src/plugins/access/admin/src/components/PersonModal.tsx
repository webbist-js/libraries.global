import {
  Alert,
  Badge,
  Box,
  Button,
  DatePicker,
  Divider,
  Field,
  Flex,
  LinkButton,
  Loader,
  Modal,
  SingleSelect,
  SingleSelectOption,
  Status,
  Textarea,
  Typography,
} from "@strapi/design-system"
import { ArrowRight, Plus, Trash } from "@strapi/icons"
import { useFetchClient, useNotification } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"

import {
  APPLICATIONS_QUEUE_PATH,
  errorMessage,
  GRANT_ROLES,
  GRANT_STATUS_META,
  type GrantRow,
  nameOf,
  type Person,
  QUEUE_LABELS,
  REASON_MAX,
  ROLE_LABELS,
  SOURCE_LABELS,
  usesLocale,
  usesQueue,
} from "./peopleMeta"
import {
  PluginModalContent,
  FormGrid,
} from "../../../../../admin/components/PluginUI"
import { formatDateTime } from "../../../../content-moderation/admin/src/components/submissionMeta"
import {
  KeyValueGrid,
  Section,
} from "../../../../content-moderation/admin/src/components/SubmissionPanels"

const ANY = "any"

function GrantStatusPill({ status }: { status: GrantRow["status"] }) {
  const meta = GRANT_STATUS_META[status]

  return (
    <Status variant={meta.variant} size="S">
      <Typography>{meta.label}</Typography>
    </Status>
  )
}

function RoleGrantCard({
  grant,
  busy,
  onRevoke,
}: {
  readonly grant: GrantRow
  readonly busy: boolean
  readonly onRevoke: (grant: GrantRow) => void
}) {
  const scope =
    [
      usesQueue(grant.role) ? (QUEUE_LABELS[grant.queue] ?? grant.queue) : null,
      usesLocale(grant.role) ? (grant.locale ?? "Any language") : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Everywhere"

  return (
    <Box background="neutral0" borderColor="neutral200" padding={5} hasRadius>
      <Flex
        gap={3}
        justifyContent="space-between"
        alignItems="flex-start"
        wrap="wrap"
      >
        <Box style={{ minWidth: 0, flex: "1 1 220px" }}>
          <Typography tag="h3" variant="delta" textColor="neutral800">
            {ROLE_LABELS[grant.role] ?? grant.role}
          </Typography>
          <Typography tag="p" textColor="neutral600" paddingTop={2}>
            {scope}
          </Typography>
        </Box>
        <Flex gap={3} wrap="wrap">
          <GrantStatusPill status={grant.status} />
          {grant.status === "active" ? (
            <Button
              size="S"
              variant="danger-light"
              startIcon={<Trash />}
              onClick={() => onRevoke(grant)}
              disabled={busy}
              aria-label={`Revoke ${ROLE_LABELS[grant.role] ?? grant.role}`}
            >
              Revoke
            </Button>
          ) : null}
        </Flex>
      </Flex>
      <Box paddingTop={4}>
        <KeyValueGrid
          rows={[
            {
              label: "Granted",
              value: grant.createdAt
                ? formatDateTime(grant.createdAt)
                : "Not recorded",
            },
            {
              label: grant.status === "revoked" ? "Ended" : "Expires",
              value: grant.expiresAt
                ? formatDateTime(grant.expiresAt)
                : "No expiry",
            },
            {
              label: "Source",
              value:
                SOURCE_LABELS[grant.source ?? ""] ??
                grant.source ??
                "Not recorded",
            },
          ]}
        />
      </Box>
      {grant.reason ? (
        <Box background="neutral100" padding={4} marginTop={4} hasRadius>
          <details>
            <summary style={{ cursor: "pointer" }}>
              <Typography tag="span" variant="pi" fontWeight="semiBold">
                Grant note and history
              </Typography>
            </summary>
            <Typography
              tag="p"
              variant="pi"
              textColor="neutral600"
              paddingTop={3}
              style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                lineHeight: 1.6,
              }}
            >
              {grant.reason}
            </Typography>
          </details>
        </Box>
      ) : null}
    </Box>
  )
}

/** The Add role form: queue and language appear only for roles that use them. */
function AddRoleForm({
  locales,
  busy,
  onSubmit,
}: {
  locales: string[]
  busy: boolean
  onSubmit: (body: {
    role: string
    queue?: string
    scopeLocale?: string
    reason: string
    expiresAt?: string
  }) => Promise<boolean>
}) {
  const [role, setRole] = useState<string>("")
  const [queue, setQueue] = useState("all")
  const [locale, setLocale] = useState(ANY)
  const [reason, setReason] = useState("")
  const [expires, setExpires] = useState<Date | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!role) return setError("Choose a role.")
    const text = reason.trim()
    if (!text) return setError("Say why you're granting it.")
    if (text.length > REASON_MAX)
      return setError(`Keep the reason to ${REASON_MAX} characters or fewer.`)
    setError(null)
    const ok = await onSubmit({
      role,
      ...(usesQueue(role) ? { queue } : {}),
      ...(usesLocale(role) && locale !== ANY ? { scopeLocale: locale } : {}),
      reason: text,
      ...(expires ? { expiresAt: expires.toISOString() } : {}),
    })
    if (ok) {
      setRole("")
      setQueue("all")
      setLocale(ANY)
      setReason("")
      setExpires(undefined)
    }
  }

  // Read once per mount: render stays pure (react-hooks/purity).
  const [tomorrow] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000))

  return (
    <Box background="neutral100" padding={4} hasRadius>
      <Flex direction="column" alignItems="stretch" gap={4}>
        <FormGrid>
          <Box>
            <Field.Root name="role" required>
              <Field.Label>Role</Field.Label>
              <SingleSelect
                placeholder="Choose a role"
                value={role}
                onChange={(v) => setRole(String(v))}
              >
                {GRANT_ROLES.map((r) => (
                  <SingleSelectOption key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
            </Field.Root>
          </Box>
          {usesQueue(role) && (
            <Box>
              <Field.Root name="queue" hint="What they may review.">
                <Field.Label>Queue</Field.Label>
                <SingleSelect
                  value={queue}
                  onChange={(v) => setQueue(String(v))}
                >
                  {Object.entries(QUEUE_LABELS).map(([id, label]) => (
                    <SingleSelectOption key={id} value={id}>
                      {label}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
                <Field.Hint />
              </Field.Root>
            </Box>
          )}
          {usesLocale(role) && (
            <Box>
              <Field.Root name="scopeLocale">
                <Field.Label>Language</Field.Label>
                <SingleSelect
                  value={locale}
                  onChange={(v) => setLocale(String(v))}
                >
                  <SingleSelectOption value={ANY}>
                    Any language
                  </SingleSelectOption>
                  {locales.map((code) => (
                    <SingleSelectOption key={code} value={code}>
                      {code}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
              </Field.Root>
            </Box>
          )}
          <Box>
            <Field.Root
              name="expiresAt"
              hint="No expiry date means ongoing access."
            >
              <Field.Label>Expires (optional)</Field.Label>
              <DatePicker
                value={expires}
                onChange={(d: Date | undefined) => setExpires(d)}
                onClear={() => setExpires(undefined)}
                clearLabel="Clear the expiry"
                minDate={tomorrow}
              />
              <Field.Hint />
            </Field.Root>
          </Box>
        </FormGrid>
        <Field.Root
          name="reason"
          required
          hint={`Kept on the grant. ${reason.trim().length} of ${REASON_MAX} characters.`}
        >
          <Field.Label>Reason</Field.Label>
          <Textarea
            value={reason}
            maxLength={REASON_MAX}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setReason(e.target.value)
            }
            placeholder="e.g. Approved by the editorial board on 2 October."
          />
          <Field.Hint />
        </Field.Root>
        {error && (
          <Typography variant="pi" textColor="danger600" role="alert">
            {error}
          </Typography>
        )}
        <Flex justifyContent="flex-end">
          <Button
            startIcon={<Plus />}
            onClick={() => void submit()}
            loading={busy}
          >
            Add role
          </Button>
        </Flex>
      </Flex>
    </Box>
  )
}

/**
 * One person's roles: every grant with its status, the Add role form and a
 * Revoke action that asks for a reason first. Revoking ends the grant now;
 * the row and its history stay.
 */
export function PersonModal({
  baUserId,
  onClose,
  onChanged,
}: {
  baUserId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const { get, post } = useFetchClient()
  const { toggleNotification } = useNotification()
  const [person, setPerson] = useState<Person | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState<GrantRow | null>(null)
  const [revokeReason, setRevokeReason] = useState("")

  const load = useCallback(async () => {
    if (!baUserId) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await get(
        `/access/people/${encodeURIComponent(baUserId)}`
      )
      setPerson((data as { data: Person }).data)
    } catch (err) {
      setError(errorMessage(err, "This person couldn't be loaded."))
    } finally {
      setLoading(false)
    }
  }, [get, baUserId])

  useEffect(() => {
    setPerson(null)
    setRevoking(null)
    setRevokeReason("")
    void load()
  }, [load])

  if (!baUserId) return null

  const addRole = async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    try {
      const { data } = await post(
        `/access/people/${encodeURIComponent(baUserId)}/grants`,
        body
      )
      setPerson((data as { data: Person }).data)
      toggleNotification({ type: "success", message: "Role added." })
      onChanged()

      return true
    } catch (err) {
      toggleNotification({
        type: "danger",
        message: errorMessage(err, "The role couldn't be added."),
      })

      return false
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    if (!revoking) return
    const reason = revokeReason.trim()
    if (!reason) {
      toggleNotification({
        type: "warning",
        message: "Say why you're revoking it.",
      })

      return
    }
    setBusy(true)
    try {
      const { data } = await post(
        `/access/grants/${revoking.documentId}/revoke`,
        { reason }
      )
      const next = (data as { data: Person | null }).data
      if (next) setPerson(next)
      else void load()
      setRevoking(null)
      setRevokeReason("")
      toggleNotification({ type: "success", message: "Role revoked." })
      onChanged()
    } catch (err) {
      toggleNotification({
        type: "danger",
        message: errorMessage(err, "The role couldn't be revoked."),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <PluginModalContent>
        <Modal.Header>
          <Flex gap={2} alignItems="center" wrap="wrap">
            <Modal.Title>{person ? nameOf(person) : "Person"}</Modal.Title>
            {person && (
              <Badge>
                {ROLE_LABELS[person.contributorRole] ?? person.contributorRole}
              </Badge>
            )}
          </Flex>
        </Modal.Header>
        <Modal.Body>
          {loading && !person ? (
            <Flex justifyContent="center" padding={8}>
              <Loader>Loading</Loader>
            </Flex>
          ) : error ? (
            <Alert
              variant="danger"
              title="Couldn't load"
              closeLabel="Dismiss"
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          ) : person ? (
            <>
              <Box paddingBottom={4}>
                <KeyValueGrid
                  rows={[
                    {
                      label: "Username",
                      value: person.username
                        ? `@${person.username}`
                        : "Not set",
                    },
                    {
                      label: "Email",
                      value: person.email ?? "No submission email recorded",
                    },
                    {
                      label: "Role",
                      value:
                        ROLE_LABELS[person.contributorRole] ??
                        person.contributorRole,
                    },
                    {
                      label: "Accepted changes",
                      value: String(person.acceptedCount),
                    },
                    {
                      label: "Verified librarian",
                      value: person.isVerifiedLibrarian ? "Yes" : "No",
                    },
                  ]}
                />
              </Box>
              {person.openApplications.length > 0 && (
                <Box paddingBottom={4}>
                  <Alert
                    variant="default"
                    title={`${person.openApplications.length} open role application${person.openApplications.length === 1 ? "" : "s"}`}
                    closeLabel="Dismiss"
                    onClose={() => {}}
                    action={
                      <LinkButton
                        tag={Link}
                        to={APPLICATIONS_QUEUE_PATH}
                        variant="tertiary"
                        endIcon={<ArrowRight />}
                      >
                        Open applications
                      </LinkButton>
                    }
                  >
                    {person.openApplications.map((a) => a.summary).join(" · ")}
                  </Alert>
                </Box>
              )}
              <Divider />
              <Section title={`Roles (${person.grants.length})`}>
                {person.grants.length === 0 ? (
                  <Typography textColor="neutral600">
                    No roles yet. They’re a reader until someone grants one.
                  </Typography>
                ) : (
                  <Flex direction="column" alignItems="stretch" gap={4}>
                    {person.grants.map((grant) => (
                      <RoleGrantCard
                        key={grant.documentId}
                        grant={grant}
                        busy={busy}
                        onRevoke={(selected) => {
                          setRevoking(selected)
                          setRevokeReason("")
                        }}
                      />
                    ))}
                  </Flex>
                )}
              </Section>
              {revoking && (
                <Box background="danger100" padding={4} hasRadius marginTop={4}>
                  <Flex direction="column" alignItems="stretch" gap={3}>
                    <Typography fontWeight="semiBold">
                      Revoke {ROLE_LABELS[revoking.role] ?? revoking.role}
                      {usesQueue(revoking.role)
                        ? ` (${QUEUE_LABELS[revoking.queue] ?? revoking.queue})`
                        : ""}
                      {usesLocale(revoking.role) && revoking.locale
                        ? ` for ${revoking.locale}`
                        : ""}
                      ?
                    </Typography>
                    <Field.Root
                      name="revokeReason"
                      required
                      hint="Kept on the grant with your admin id and today's date."
                    >
                      <Field.Label>Why are you revoking it?</Field.Label>
                      <Textarea
                        value={revokeReason}
                        maxLength={REASON_MAX}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setRevokeReason(e.target.value)
                        }
                        autoFocus
                      />
                      <Field.Hint />
                    </Field.Root>
                    <Flex gap={2} justifyContent="flex-end">
                      <Button
                        variant="tertiary"
                        onClick={() => setRevoking(null)}
                        disabled={busy}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        startIcon={<Trash />}
                        onClick={() => void revoke()}
                        loading={busy}
                      >
                        Revoke role
                      </Button>
                    </Flex>
                  </Flex>
                </Box>
              )}
              <Section title="Add role">
                <AddRoleForm
                  locales={person.locales}
                  busy={busy}
                  onSubmit={addRole}
                />
              </Section>
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Typography variant="pi" textColor="neutral500">
            Roles are never bought or earned through points.
          </Typography>
          <Modal.Close>
            <Button variant="tertiary">Close</Button>
          </Modal.Close>
        </Modal.Footer>
      </PluginModalContent>
    </Modal.Root>
  )
}
