import {
  Alert,
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Loader,
  Modal,
  Searchbar,
  SingleSelect,
  SingleSelectOption,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"
import {
  Layouts,
  Page,
  useFetchClient,
  useAuth,
  useNotification,
} from "@strapi/strapi/admin"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  PluginTable,
  PluginPage,
  PluginEmptyState,
  StatsGrid,
  FormGrid,
} from "../../../admin/components/PluginUI"

type Row = {
  id: string
  email: string
  locale: string
  requestedAt: string
  sentAt?: string
  acceptedAt?: string
  status: string
}
type Result = {
  data: Row[]
  counts: Record<string, number>
  total: number
  sendingAvailable: boolean
}
type History = {
  id: string
  status: string
  issuedAt: string
  sentAt?: string
  acceptedAt?: string
  revokedAt?: string
  expiresAt: string
  accessExpiresAt?: string
  attempts: number
  lastError?: string
}
const labels: Record<string, string> = {
  waiting: "Waiting",
  queued: "Queued",
  sent: "Sent",
  accepted: "Accepted",
  failed: "Failed",
  expired: "Expired",
  revoked: "Revoked",
  unavailable: "Unavailable",
}
const permission = [{ action: "plugin::beta-invites.manage", subject: null }]
const date = (value?: string) =>
  value ? new Date(value).toLocaleString() : "—"
const errorText = (error: any) =>
  error?.response?.data?.error?.message || "The request failed. Please retry."

export function App() {
  const loading = useAuth("BetaInvites", (state) => state.isLoading)
  const user = useAuth("BetaInvites", (state) => state.user)
  const permissions = useAuth("BetaInvites", (state) => state.permissions)
  if (loading) return <Page.Loading />

  return (
    <ProtectedDashboard key={`${user?.id}:${JSON.stringify(permissions)}`} />
  )
}
function ProtectedDashboard() {
  return (
    <Page.Protect permissions={permission}>
      <Dashboard />
    </Page.Protect>
  )
}

function Dashboard() {
  const { get, post } = useFetchClient()
  const { toggleNotification } = useNotification()
  const [q, setQ] = useState("")
  const [locale, setLocale] = useState("all")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Result>({
    data: [],
    counts: {},
    total: 0,
    sendingAvailable: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [confirmation, setConfirmation] = useState<{
    row: Row
    action: string
  } | null>(null)
  const [history, setHistory] = useState<{
    row: Row
    entries: History[]
  } | null>(null)
  const [preview, setPreview] = useState<{
    subject: string
    html: string
    text: string
  } | null>(null)
  const serial = useRef(0)
  const busyRef = useRef(false)
  const load = useCallback(async () => {
    const request = ++serial.current
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({
        q: q.trim(),
        locale: locale === "all" ? "" : locale,
        status: status === "all" ? "" : status,
        page: String(page),
      })
      const { data } = await get(`/beta-invites/subscribers?${params}`)
      if (request === serial.current) setResult(data as Result)
    } catch (err) {
      if (request === serial.current) setError(errorText(err))
    } finally {
      if (request === serial.current) setLoading(false)
    }
  }, [get, q, locale, status, page])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 300)

    return () => {
      clearTimeout(timer)
      serial.current++
    }
  }, [load])
  useEffect(() => {
    const timer = setInterval(() => void load(), 15000)

    return () => clearInterval(timer)
  }, [load])

  async function act(row: Row, action: string) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(row.id)
    try {
      const { data } = await post<{ queued?: boolean }>(
        `/beta-invites/subscribers/${row.id}/${action}`,
        {}
      )
      toggleNotification({
        type: "success",
        message:
          action === "revoke"
            ? "Invitation and browser access revoked."
            : data.queued === false
              ? "An invitation already exists. Resends are limited to once a minute."
              : "Invitation updated. The dashboard will show the sending result.",
      })
      setConfirmation(null)
      await load()
    } catch (err) {
      toggleNotification({ type: "danger", message: errorText(err) })
    } finally {
      busyRef.current = false
      setBusy("")
    }
  }
  async function showHistory(row: Row) {
    try {
      const { data } = await get<{ data: History[] }>(
        `/beta-invites/subscribers/${row.id}/history`
      )
      setHistory({ row, entries: data.data })
    } catch (err) {
      toggleNotification({ type: "danger", message: errorText(err) })
    }
  }
  async function showPreview() {
    try {
      const { data } = await get<{
        subject: string
        html: string
        text: string
      }>(`/beta-invites/preview?locale=${locale === "all" ? "en" : locale}`)
      setPreview(data)
    } catch (err) {
      toggleNotification({ type: "danger", message: errorText(err) })
    }
  }

  return (
    <PluginPage>
      <Layouts.Root>
        <Layouts.Header
          title="Beta invites"
          subtitle="Review access requests and send individual invitations."
          primaryAction={
            <Flex gap={2}>
              <Button variant="secondary" onClick={() => void showPreview()}>
                Preview email
              </Button>
              <Button
                variant="secondary"
                loading={loading}
                onClick={() => void load()}
              >
                Refresh
              </Button>
            </Flex>
          }
        />
        <Layouts.Content>
          <Box paddingBottom={5}>
            <Typography textColor="neutral600">
              Invites expire after seven days. Acceptance grants 30 days of
              browser access. Sent means accepted by the email provider.
            </Typography>
          </Box>
          <StatsGrid>
            {Object.entries(labels).map(([key, label]) => (
              <Box
                key={key}
                background="neutral0"
                padding={4}
                hasRadius
                borderColor="neutral200"
              >
                <Typography
                  tag="p"
                  variant="alpha"
                  textColor="neutral800"
                  paddingBottom={2}
                >
                  {loading ? "—" : (result.counts[key] ?? 0)}
                </Typography>
                <Typography variant="pi" textColor="neutral600">
                  {label}
                </Typography>
              </Box>
            ))}
          </StatsGrid>
          {error && (
            <Box paddingBottom={4}>
              <Alert
                variant="danger"
                title="Couldn't load invitations"
                closeLabel="Dismiss"
                onClose={() => setError("")}
              >
                {error}
              </Alert>
            </Box>
          )}
          {!loading && !result.sendingAvailable && (
            <Box paddingBottom={4}>
              <Alert
                variant="warning"
                title="Sending unavailable"
                closeLabel="Refresh status"
                onClose={() => void load()}
              >
                Configure the email provider before sending invitations.
              </Alert>
            </Box>
          )}
          <Box background="neutral0" padding={6} hasRadius shadow="tableShadow">
            <FormGrid paddingBottom={5}>
              <Box style={{ minWidth: 0 }}>
                <Typography
                  tag="p"
                  variant="pi"
                  fontWeight="bold"
                  paddingBottom={1}
                >
                  Search
                </Typography>
                <Searchbar
                  name="beta-search"
                  value={q}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setQ(e.target.value)
                    setPage(1)
                  }}
                  onClear={() => {
                    setQ("")
                    setPage(1)
                  }}
                  clearLabel="Clear email search"
                  placeholder="Search email addresses"
                >
                  Search beta requests
                </Searchbar>
              </Box>
              <Field.Root>
                <Field.Label>Language</Field.Label>
                <SingleSelect
                  value={locale}
                  onChange={(value) => {
                    setLocale(String(value))
                    setPage(1)
                  }}
                >
                  <SingleSelectOption value="all">
                    All languages
                  </SingleSelectOption>
                  <SingleSelectOption value="en">English</SingleSelectOption>
                  <SingleSelectOption value="cs">Czech</SingleSelectOption>
                  <SingleSelectOption value="fr">French</SingleSelectOption>
                </SingleSelect>
              </Field.Root>
              <Field.Root>
                <Field.Label>Status</Field.Label>
                <SingleSelect
                  value={status}
                  onChange={(value) => {
                    setStatus(String(value))
                    setPage(1)
                  }}
                >
                  <SingleSelectOption value="all">
                    All requests
                  </SingleSelectOption>
                  {Object.entries(labels).map(([key, label]) => (
                    <SingleSelectOption key={key} value={key}>
                      {label}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
              </Field.Root>
            </FormGrid>
            {loading && result.data.length === 0 ? (
              <Loader>Loading invitations</Loader>
            ) : result.data.length === 0 ? (
              <PluginEmptyState
                title={
                  q.trim() || status !== "all" || locale !== "all"
                    ? "No matching requests"
                    : "No beta requests yet"
                }
                description={
                  q.trim() || status !== "all" || locale !== "all"
                    ? "Try a different email, language or status to find a request."
                    : "New access requests will appear here. Review a request before sending its invitation."
                }
              />
            ) : (
              <PluginTable colCount={6} rowCount={result.data.length + 1}>
                <Thead>
                  <Tr>
                    {[
                      "Email",
                      "Language",
                      "Requested",
                      "Status",
                      "Sent / accepted",
                      "Actions",
                    ].map((label) => (
                      <Th key={label}>
                        <Typography variant="sigma">{label}</Typography>
                      </Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {result.data.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <Typography fontWeight="semiBold">
                          {row.email}
                        </Typography>
                      </Td>
                      <Td>
                        <Typography>{row.locale.toUpperCase()}</Typography>
                      </Td>
                      <Td>
                        <Typography>{date(row.requestedAt)}</Typography>
                      </Td>
                      <Td>
                        <Badge>{labels[row.status]}</Badge>
                      </Td>
                      <Td>
                        <Typography variant="pi">
                          {date(row.acceptedAt || row.sentAt)}
                        </Typography>
                      </Td>
                      <Td>
                        <Flex gap={2} wrap="wrap">
                          {["waiting", "revoked", "expired"].includes(
                            row.status
                          ) && (
                            <Button
                              size="S"
                              disabled={!!busy || !result.sendingAvailable}
                              loading={busy === row.id}
                              onClick={() => void act(row, "send")}
                            >
                              Send invite
                            </Button>
                          )}
                          {row.status === "failed" && (
                            <Button
                              size="S"
                              disabled={!!busy || !result.sendingAvailable}
                              onClick={() => void act(row, "retry")}
                            >
                              Retry
                            </Button>
                          )}
                          {["sent", "accepted", "failed"].includes(
                            row.status
                          ) && (
                            <Button
                              size="S"
                              variant="secondary"
                              disabled={!!busy || !result.sendingAvailable}
                              onClick={() =>
                                setConfirmation({ row, action: "resend" })
                              }
                            >
                              Resend
                            </Button>
                          )}
                          {["queued", "sent", "accepted", "failed"].includes(
                            row.status
                          ) && (
                            <Button
                              size="S"
                              variant="danger-light"
                              disabled={!!busy}
                              onClick={() =>
                                setConfirmation({ row, action: "revoke" })
                              }
                            >
                              Revoke
                            </Button>
                          )}
                          <Button
                            size="S"
                            variant="tertiary"
                            onClick={() => void showHistory(row)}
                          >
                            History
                          </Button>
                        </Flex>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </PluginTable>
            )}
            <Flex justifyContent="space-between" paddingTop={5}>
              <Typography aria-live="polite">
                {result.total} requests · Page {page} of{" "}
                {Math.max(1, Math.ceil(result.total / 25))}
              </Typography>
              <Flex gap={2}>
                <Button
                  variant="secondary"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page * 25 >= result.total || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </Flex>
            </Flex>
          </Box>
        </Layouts.Content>
        {confirmation && (
          <Modal.Root
            open
            onOpenChange={(open: boolean) => {
              if (!open && !busy) setConfirmation(null)
            }}
          >
            <Modal.Content>
              <Modal.Header>
                <Modal.Title>
                  {confirmation.action === "revoke"
                    ? "Revoke beta access"
                    : "Replace invitation"}
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Typography>{confirmation.row.email}</Typography>
                <Box paddingTop={3}>
                  <Typography>
                    {confirmation.action === "revoke"
                      ? "This ends their invitation and any beta browser access immediately."
                      : "This sends a new code and ends their previous invitation and any beta browser access."}
                  </Typography>
                </Box>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="tertiary"
                  disabled={!!busy}
                  onClick={() => setConfirmation(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  loading={!!busy}
                  onClick={() =>
                    void act(confirmation.row, confirmation.action)
                  }
                >
                  {confirmation.action === "revoke"
                    ? "Revoke access"
                    : "Send replacement"}
                </Button>
              </Modal.Footer>
            </Modal.Content>
          </Modal.Root>
        )}
        {history && (
          <Modal.Root
            open
            onOpenChange={(open: boolean) => !open && setHistory(null)}
          >
            <Modal.Content>
              <Modal.Header>
                <Modal.Title>Invitation history</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Typography fontWeight="semiBold">
                  {history.row.email}
                </Typography>
                {history.entries.length === 0 ? (
                  <Box paddingTop={4}>
                    <Typography>No invitations have been sent.</Typography>
                  </Box>
                ) : (
                  history.entries.map((entry) => (
                    <Box
                      key={entry.id}
                      paddingTop={5}
                      paddingBottom={4}
                      borderColor="neutral200"
                      borderStyle="solid"
                      borderWidth="0 0 1px"
                    >
                      <Badge>{labels[entry.status]}</Badge>
                      <Box paddingTop={3}>
                        <Typography>
                          Issued: {date(entry.issuedAt)}
                          <br />
                          Sent: {date(entry.sentAt)}
                          <br />
                          Accepted: {date(entry.acceptedAt)}
                          <br />
                          Revoked: {date(entry.revokedAt)}
                          <br />
                          {entry.acceptedAt
                            ? "Access ends"
                            : "Invite expires"}:{" "}
                          {date(entry.accessExpiresAt || entry.expiresAt)}
                          <br />
                          Failed attempts: {entry.attempts}
                          {entry.lastError && (
                            <>
                              <br />
                              {entry.lastError}
                            </>
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  ))
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setHistory(null)}>
                  Close
                </Button>
              </Modal.Footer>
            </Modal.Content>
          </Modal.Root>
        )}
        {preview && (
          <Modal.Root
            open
            onOpenChange={(open: boolean) => !open && setPreview(null)}
          >
            <Modal.Content>
              <Modal.Header>
                <Modal.Title>Email preview</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Typography>{preview.subject}</Typography>
                <Box paddingTop={4}>
                  <iframe
                    title="Beta invitation email"
                    srcDoc={preview.html}
                    sandbox=""
                    style={{ width: "100%", height: "600px", border: 0 }}
                  />
                </Box>
                <Typography variant="pi">
                  This preview uses a fictional code and sends no email.
                </Typography>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setPreview(null)}>
                  Close
                </Button>
              </Modal.Footer>
            </Modal.Content>
          </Modal.Root>
        )}
      </Layouts.Root>
    </PluginPage>
  )
}
