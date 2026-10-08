import {
  Alert,
  Box,
  Button,
  DatePicker,
  Dialog,
  EmptyStateLayout,
  Field,
  Flex,
  IconButton,
  Loader,
  Modal,
  Searchbar,
  SingleSelect,
  SingleSelectOption,
  Status,
  Table,
  Tabs,
  Tbody,
  Td,
  Textarea,
  TextInput,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"
import { ArrowClockwise, Plus, Trash } from "@strapi/icons"
import { EmptyDocuments } from "@strapi/icons/symbols"
import { Layouts, useFetchClient, useNotification } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

import { type AccessSection, PluginNav } from "../components/PluginNav"
import {
  apiError,
  dateCell,
  GRANT_SOURCE_LABELS,
  PLAN_LABELS,
  type PlanGrant,
  ROW_STATUS_META,
  type Verification,
  VERIFICATION_KIND_LABELS,
} from "../components/teamsMeta"

const REASON_MAX = 500

type Tab = "grants" | "verifications"

/**
 * Plans: complimentary plans (Pro or Team for one person) and Pro
 * verifications (library staff, student, charity). Grant by Better Auth id
 * or by the email a person's submissions came from, with a reason and an
 * optional expiry; revoke with a reason. Nothing here touches a role.
 */
export function PlansPage({
  allowed,
}: {
  allowed?: Record<AccessSection, boolean>
}) {
  const { get, post } = useFetchClient()
  const { toggleNotification } = useNotification()
  const [tab, setTab] = useState<Tab>("grants")
  const [query, setQuery] = useState("")
  const [grants, setGrants] = useState<PlanGrant[]>([])
  const [verifications, setVerifications] = useState<Verification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [revoking, setRevoking] = useState<{
    kind: Tab
    documentId: string
    label: string
  } | null>(null)
  const [revokeReason, setRevokeReason] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (q: string) => {
      setLoading(true)
      setError(null)
      try {
        const [g, v] = await Promise.all([
          get(`/access/plans/grants?q=${encodeURIComponent(q)}`),
          get(`/access/plans/verifications?q=${encodeURIComponent(q)}`),
        ])
        setGrants((g.data as { data?: PlanGrant[] })?.data ?? [])
        setVerifications((v.data as { data?: Verification[] })?.data ?? [])
      } catch (err) {
        setError(
          apiError(
            err,
            "Plans couldn't be loaded. Check that you can manage plans."
          )
        )
      } finally {
        setLoading(false)
      }
    },
    [get]
  )

  useEffect(() => {
    void load("")
  }, [load])

  useEffect(() => {
    const timer = setTimeout(() => void load(query.trim()), 300)

    return () => clearTimeout(timer)
  }, [query, load])

  async function revoke() {
    if (!revoking) return
    setBusy(true)
    try {
      await post(
        `/access/plans/${revoking.kind}/${revoking.documentId}/revoke`,
        { reason: revokeReason.trim() }
      )
      toggleNotification({ type: "success", message: "Revoked." })
      setRevoking(null)
      setRevokeReason("")
      await load(query.trim())
    } catch (err) {
      setError(apiError(err, "It couldn't be revoked."))
    } finally {
      setBusy(false)
    }
  }

  const empty = (what: string) => (
    <EmptyStateLayout
      icon={<EmptyDocuments width="10rem" />}
      content={
        query.trim() ? `No ${what} for that id or email.` : `No ${what} yet.`
      }
      action={
        <Button startIcon={<Plus />} onClick={() => setAdding(true)}>
          {tab === "grants" ? "Grant a plan" : "Add a verification"}
        </Button>
      }
    />
  )

  return (
    <Layouts.Root>
      <Layouts.Header
        title="Plans"
        subtitle="Complimentary plans and Pro verifications. Plans never change a role."
        primaryAction={
          <Flex gap={2}>
            <Button
              variant="secondary"
              startIcon={<ArrowClockwise />}
              onClick={() => void load(query.trim())}
              loading={loading}
            >
              Refresh
            </Button>
            <Button startIcon={<Plus />} onClick={() => setAdding(true)}>
              {tab === "grants" ? "Grant a plan" : "Add a verification"}
            </Button>
          </Flex>
        }
      />
      <Layouts.Content>
        <PluginNav current="plans" allowed={allowed} />
        {error && (
          <Box paddingBottom={4}>
            <Alert
              variant="danger"
              title="Something went wrong"
              closeLabel="Dismiss"
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          </Box>
        )}
        <Box background="neutral0" padding={6} hasRadius shadow="tableShadow">
          <Box width="32rem" paddingBottom={4}>
            <Searchbar
              name="plans-search"
              size="S"
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setQuery(e.target.value)
              }
              onClear={() => setQuery("")}
              clearLabel="Clear search"
              placeholder="Filter by Better Auth id or email"
            >
              Filter plans
            </Searchbar>
          </Box>
          <Tabs.Root
            value={tab}
            onValueChange={(v: string) => setTab(v as Tab)}
          >
            <Tabs.List aria-label="Plan kinds">
              <Tabs.Trigger value="grants">
                Plan grants ({grants.length})
              </Tabs.Trigger>
              <Tabs.Trigger value="verifications">
                Verifications ({verifications.length})
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="grants">
              <Box paddingTop={4}>
                {loading && grants.length === 0 ? (
                  <Flex justifyContent="center" padding={8}>
                    <Loader>Loading plans</Loader>
                  </Flex>
                ) : grants.length === 0 ? (
                  empty("plan grants")
                ) : (
                  <Table colCount={7} rowCount={grants.length + 1}>
                    <Thead>
                      <Tr>
                        <Th>
                          <Typography variant="sigma">Person</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Plan</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Source</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Status</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Expires</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Reason</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Actions</Typography>
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {grants.map((g) => (
                        <Tr key={g.documentId}>
                          <Td>
                            <Typography fontWeight="semiBold">
                              {g.name ?? g.baUserId}
                            </Typography>
                            {g.name && (
                              <Typography
                                variant="pi"
                                textColor="neutral600"
                                tag="p"
                              >
                                {g.baUserId}
                              </Typography>
                            )}
                          </Td>
                          <Td>
                            <Typography>
                              {PLAN_LABELS[g.plan] ?? g.plan}
                            </Typography>
                          </Td>
                          <Td>
                            <Typography>
                              {GRANT_SOURCE_LABELS[g.source ?? ""] ??
                                g.source ??
                                "—"}
                            </Typography>
                          </Td>
                          <Td>
                            <Status
                              variant={ROW_STATUS_META[g.status].variant}
                              size="S"
                            >
                              {ROW_STATUS_META[g.status].label}
                            </Status>
                          </Td>
                          <Td>
                            <Typography>{dateCell(g.expiresAt)}</Typography>
                          </Td>
                          <Td>
                            <Typography
                              variant="pi"
                              ellipsis
                              style={{ maxWidth: "24rem" }}
                            >
                              {g.reason ?? "—"}
                            </Typography>
                          </Td>
                          <Td>
                            {g.status === "active" && (
                              <IconButton
                                label={`Revoke ${PLAN_LABELS[g.plan] ?? g.plan} for ${g.name ?? g.baUserId}`}
                                variant="danger-light"
                                onClick={() =>
                                  setRevoking({
                                    kind: "grants",
                                    documentId: g.documentId,
                                    label: `${PLAN_LABELS[g.plan] ?? g.plan} for ${g.name ?? g.baUserId}`,
                                  })
                                }
                              >
                                <Trash />
                              </IconButton>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
              </Box>
            </Tabs.Content>
            <Tabs.Content value="verifications">
              <Box paddingTop={4}>
                {loading && verifications.length === 0 ? (
                  <Flex justifyContent="center" padding={8}>
                    <Loader>Loading verifications</Loader>
                  </Flex>
                ) : verifications.length === 0 ? (
                  empty("verifications")
                ) : (
                  <Table colCount={6} rowCount={verifications.length + 1}>
                    <Thead>
                      <Tr>
                        <Th>
                          <Typography variant="sigma">Person</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Kind</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">
                            Verified email
                          </Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Status</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Expires</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Actions</Typography>
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {verifications.map((v) => (
                        <Tr key={v.documentId}>
                          <Td>
                            <Typography fontWeight="semiBold">
                              {v.name ?? v.baUserId}
                            </Typography>
                            {v.name && (
                              <Typography
                                variant="pi"
                                textColor="neutral600"
                                tag="p"
                              >
                                {v.baUserId}
                              </Typography>
                            )}
                          </Td>
                          <Td>
                            <Typography>
                              {VERIFICATION_KIND_LABELS[v.kind] ?? v.kind}
                            </Typography>
                          </Td>
                          <Td>
                            <Typography>{v.verifiedEmail ?? "—"}</Typography>
                          </Td>
                          <Td>
                            <Status
                              variant={ROW_STATUS_META[v.status].variant}
                              size="S"
                            >
                              {ROW_STATUS_META[v.status].label}
                            </Status>
                          </Td>
                          <Td>
                            <Typography>{dateCell(v.expiresAt)}</Typography>
                          </Td>
                          <Td>
                            {v.status === "active" && (
                              <IconButton
                                label={`Revoke the verification for ${v.name ?? v.baUserId}`}
                                variant="danger-light"
                                onClick={() =>
                                  setRevoking({
                                    kind: "verifications",
                                    documentId: v.documentId,
                                    label: `the ${VERIFICATION_KIND_LABELS[v.kind] ?? v.kind} verification for ${v.name ?? v.baUserId}`,
                                  })
                                }
                              >
                                <Trash />
                              </IconButton>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
              </Box>
            </Tabs.Content>
          </Tabs.Root>
        </Box>
      </Layouts.Content>
      {adding && (
        <AddPlanModal
          kind={tab}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            void load(query.trim())
          }}
        />
      )}
      <Dialog.Root
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
      >
        <Dialog.Content>
          <Dialog.Header>Revoke {revoking?.label}?</Dialog.Header>
          <Dialog.Body>
            <Flex direction="column" alignItems="stretch" gap={3}>
              <Typography>
                It ends now. The row stays with the reason, and the person’s
                session refreshes within a minute.
              </Typography>
              <Field.Root
                name="revokeReason"
                required
                hint={`${revokeReason.trim().length} of ${REASON_MAX} characters.`}
              >
                <Field.Label>Reason</Field.Label>
                <Textarea
                  value={revokeReason}
                  maxLength={REASON_MAX}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setRevokeReason(e.target.value)
                  }
                />
                <Field.Hint />
              </Field.Root>
            </Flex>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Keep</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button
                variant="danger-light"
                loading={busy}
                disabled={!revokeReason.trim()}
                onClick={() => void revoke()}
              >
                Revoke
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Layouts.Root>
  )
}

/** Grant a plan, or add a verification, for a person named by id or email. */
function AddPlanModal({
  kind,
  onClose,
  onSaved,
}: {
  kind: Tab
  onClose: () => void
  onSaved: () => void
}) {
  const { post } = useFetchClient()
  const { toggleNotification } = useNotification()
  const [person, setPerson] = useState("")
  const [plan, setPlan] = useState("pro")
  const [source, setSource] = useState("admin")
  const [verificationKind, setVerificationKind] = useState("library_staff")
  const [verifiedEmail, setVerifiedEmail] = useState("")
  const [reason, setReason] = useState("")
  const [expires, setExpires] = useState<Date | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await post(
        kind === "grants"
          ? "/access/plans/grants"
          : "/access/plans/verifications",
        kind === "grants"
          ? {
              person: person.trim(),
              plan,
              source,
              reason: reason.trim(),
              expiresAt: expires ? expires.toISOString() : null,
            }
          : {
              person: person.trim(),
              kind: verificationKind,
              verifiedEmail: verifiedEmail.trim() || undefined,
              expiresAt: expires ? expires.toISOString() : null,
            }
      )
      toggleNotification({
        type: "success",
        message: kind === "grants" ? "Plan granted." : "Verification added.",
      })
      onSaved()
    } catch (err) {
      setError(apiError(err, "It couldn't be saved."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>
            {kind === "grants" ? "Grant a plan" : "Add a verification"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root
              name="person"
              required
              hint="A Better Auth id (from their profile), or the email their submissions were sent from."
            >
              <Field.Label>Person</Field.Label>
              <TextInput
                value={person}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPerson(e.target.value)
                }
                placeholder="id or email"
              />
              <Field.Hint />
            </Field.Root>
            {kind === "grants" ? (
              <Flex gap={4} wrap="wrap">
                <Box width="12rem">
                  <Field.Root name="plan" required>
                    <Field.Label>Plan</Field.Label>
                    <SingleSelect
                      value={plan}
                      onChange={(v) => setPlan(String(v))}
                    >
                      {Object.entries(PLAN_LABELS).map(([id, label]) => (
                        <SingleSelectOption key={id} value={id}>
                          {label}
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                  </Field.Root>
                </Box>
                <Box width="14rem">
                  <Field.Root name="source">
                    <Field.Label>Source</Field.Label>
                    <SingleSelect
                      value={source}
                      onChange={(v) => setSource(String(v))}
                    >
                      {Object.entries(GRANT_SOURCE_LABELS).map(
                        ([id, label]) => (
                          <SingleSelectOption key={id} value={id}>
                            {label}
                          </SingleSelectOption>
                        )
                      )}
                    </SingleSelect>
                  </Field.Root>
                </Box>
              </Flex>
            ) : (
              <Flex gap={4} wrap="wrap">
                <Box width="14rem">
                  <Field.Root name="kind" required>
                    <Field.Label>Kind</Field.Label>
                    <SingleSelect
                      value={verificationKind}
                      onChange={(v) => setVerificationKind(String(v))}
                    >
                      {Object.entries(VERIFICATION_KIND_LABELS).map(
                        ([id, label]) => (
                          <SingleSelectOption key={id} value={id}>
                            {label}
                          </SingleSelectOption>
                        )
                      )}
                    </SingleSelect>
                  </Field.Root>
                </Box>
                <Box width="20rem">
                  <Field.Root
                    name="verifiedEmail"
                    hint="The institutional email you checked."
                  >
                    <Field.Label>Verified email (optional)</Field.Label>
                    <TextInput
                      type="email"
                      value={verifiedEmail}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setVerifiedEmail(e.target.value)
                      }
                    />
                    <Field.Hint />
                  </Field.Root>
                </Box>
              </Flex>
            )}
            <Box width="14rem">
              <Field.Root name="expiresAt" hint="Leave empty for no end.">
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
            {kind === "grants" && (
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
                  placeholder="e.g. Press access for the Guardian's data desk until March."
                />
                <Field.Hint />
              </Field.Root>
            )}
            {error && (
              <Typography variant="pi" textColor="danger600" role="alert">
                {error}
              </Typography>
            )}
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cancel</Button>
          </Modal.Close>
          <Button
            startIcon={<Plus />}
            loading={busy}
            disabled={!person.trim() || (kind === "grants" && !reason.trim())}
            onClick={() => void save()}
          >
            {kind === "grants" ? "Grant" : "Add"}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
