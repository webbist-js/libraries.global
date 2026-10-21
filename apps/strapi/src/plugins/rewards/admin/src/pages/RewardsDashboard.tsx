import {
  Alert,
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  NumberInput,
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
import {
  Layouts,
  Page,
  useAuth,
  useFetchClient,
  useRBAC,
} from "@strapi/strapi/admin"
import { useCallback, useEffect, useRef, useState } from "react"

import { PluginPage } from "../../../../../admin/components/PluginUI"

type PointEvent = {
  id: number
  baUserId: string
  action: string
  points: number
  awardedAt: string
  metadata: Record<string, unknown> | null
}
type Stats = { totalContributors: number; pointsThisMonth: number }
type ChartData = {
  dailyPoints: { date: string; points: number }[]
  actionBreakdown: { action: string; count: number; totalPoints: number }[]
}
type History = {
  data: PointEvent[]
  meta: { total: number; page: number; limit: number }
}
const ACTIONS: Record<string, string> = {
  new_library_approved: "New library",
  edit_accepted_major: "Major edit",
  edit_accepted_minor: "Minor edit",
  wiki_translated: "Wiki translation",
  knowledge_edit_accepted: "Knowledge edit",
  knowledge_article_published: "Knowledge article",
  journal_accepted: "Journal article",
  journal_edit_accepted: "Journal edit",
  journal_translated: "Journal translation",
  source_added: "Source added",
  correction_approved: "Correction",
  claim_approved: "Library claim",
  photo_licensed_cc: "CC photo",
  hours_verified: "Hours verified",
  status_verified: "Status verified",
  daily_streak: "Daily streak",
  manual_award: "Manual award",
  manual_deduct: "Manual deduction",
  drive_task_accepted: "Drive task",
  drive_finished: "Drive finished",
  drive_proposal_accepted: "Drive proposal",
}
const actionLabel = (action: string) =>
  ACTIONS[action] ?? action.replaceAll("_", " ")
const PERMISSIONS = [
  { action: "plugin::rewards.read", subject: null },
  { action: "plugin::rewards.award", subject: null },
]

const pointEventCount = (total: number) =>
  `${total.toLocaleString()} point ${total === 1 ? "event" : "events"}`

function useAdminResource<T>(path: string, revision: number) {
  const { get } = useFetchClient()
  const [resource, setResource] = useState<{ path: string; value: T } | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    // Reset the external request state when its identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(false)
    get<{ data?: T; meta?: unknown }>(`/rewards${path}`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (!controller.signal.aborted)
          setResource({
            path,
            value: (data?.meta ? data : (data?.data ?? data)) as T,
          })
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [get, path, revision, retry])

  return {
    data: resource?.path === path ? resource.value : null,
    loading,
    error,
    retry: () => setRetry((value) => value + 1),
  }
}
function Failure({ retry }: { retry: () => void }) {
  return (
    <Box paddingBottom={4}>
      <Alert
        variant="danger"
        title="Couldn’t load rewards"
        closeLabel="Retry"
        onClose={retry}
      >
        This view is unavailable.{" "}
        <Button variant="tertiary" onClick={retry}>
          Try again
        </Button>
      </Alert>
    </Box>
  )
}
function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Box
      background="neutral0"
      padding={6}
      hasRadius
      shadow="tableShadow"
      style={{ minWidth: 0 }}
    >
      <Typography tag="h2" variant="delta" paddingBottom={4}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}
function EventLog({
  revision,
  canAward,
  onAward,
}: {
  revision: number
  canAward: boolean
  onAward: (id: string) => void
}) {
  const [page, setPage] = useState(1)
  const [user, setUser] = useState("")
  const [action, setAction] = useState("")
  const [filter, setFilter] = useState({ user: "", action: "" })
  const query = new URLSearchParams({
    page: String(page),
    ...(filter.user ? { baUserId: filter.user } : {}),
    ...(filter.action ? { action: filter.action } : {}),
  })
  const result = useAdminResource<History>(`/events?${query}`, revision)
  const events = result.data?.data ?? []
  const total = result.data?.meta.total ?? 0
  const limit = result.data?.meta.limit ?? 50
  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <Card title="Points history">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          setFilter({ user: user.trim(), action })
        }}
      >
        <Flex gap={4} wrap="wrap" alignItems="flex-end" paddingBottom={5}>
          <Box style={{ flex: "1 1 22rem" }}>
            <Field.Root name="history-user">
              <Field.Label>Contributor ID</Field.Label>
              <TextInput
                value={user}
                maxLength={255}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setUser(event.target.value)
                }
                placeholder="All contributors"
              />
            </Field.Root>
          </Box>
          <Box style={{ flex: "1 1 22rem" }}>
            <Field.Root name="history-action">
              <Field.Label>Action</Field.Label>
              <SingleSelect
                value={action || "all"}
                onChange={(value) =>
                  setAction(value === "all" ? "" : String(value))
                }
              >
                <SingleSelectOption value="all">All actions</SingleSelectOption>
                {Object.entries(ACTIONS).map(([value, label]) => (
                  <SingleSelectOption key={value} value={value}>
                    {label}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
            </Field.Root>
          </Box>
          <Button type="submit" variant="secondary" disabled={result.loading}>
            Apply filters
          </Button>
          <Button
            variant="tertiary"
            onClick={() => {
              setUser("")
              setAction("")
              setFilter({ user: "", action: "" })
              setPage(1)
            }}
          >
            Clear
          </Button>
        </Flex>
      </form>
      {result.error && <Failure retry={result.retry} />}
      <Typography
        tag="p"
        textColor="neutral600"
        paddingBottom={4}
        aria-live="polite"
      >
        {result.loading ? "Loading points history…" : pointEventCount(total)}
      </Typography>
      {events.length ? (
        <Box style={{ overflowX: "auto" }}>
          <Table
            colCount={canAward ? 6 : 5}
            rowCount={events.length}
            aria-label="Point events"
          >
            <Thead>
              <Tr>
                {[
                  "Contributor",
                  "Action",
                  "Points",
                  "Awarded",
                  "Details",
                  ...(canAward ? ["Actions"] : []),
                ].map((label) => (
                  <Th key={label}>
                    <Typography variant="sigma">{label}</Typography>
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {events.map((event) => (
                <Tr key={event.id}>
                  <Td>
                    <Typography textColor="neutral800">
                      {event.baUserId}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography>{actionLabel(event.action)}</Typography>
                  </Td>
                  <Td>
                    <Typography
                      textColor={event.points < 0 ? "danger600" : "success600"}
                      fontWeight="semiBold"
                    >
                      {event.points > 0 ? "+" : ""}
                      {event.points}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography textColor="neutral600">
                      {new Date(event.awardedAt).toLocaleString()}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography
                      textColor="neutral600"
                      style={{
                        whiteSpace: "normal",
                        maxWidth: "30rem",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {event.metadata ? JSON.stringify(event.metadata) : "—"}
                    </Typography>
                  </Td>
                  {canAward && (
                    <Td>
                      <Button
                        variant="tertiary"
                        size="S"
                        onClick={() => onAward(event.baUserId)}
                      >
                        Adjust points
                      </Button>
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      ) : !result.loading && !result.error ? (
        <Typography tag="p" textColor="neutral600">
          {filter.user || filter.action
            ? "No point events match these filters."
            : "No points have been awarded yet."}
        </Typography>
      ) : null}
      {total > limit && (
        <Flex
          justifyContent="space-between"
          gap={4}
          paddingTop={5}
          aria-label="History pages"
        >
          <Button
            variant="secondary"
            disabled={result.loading || page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <Typography textColor="neutral600">
            Page {page} of {pages}
          </Typography>
          <Button
            variant="secondary"
            disabled={result.loading || page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </Flex>
      )}
    </Card>
  )
}
function ManualAward({
  user,
  onSuccess,
}: {
  user: string
  onSuccess: () => void
}) {
  const { put } = useFetchClient()
  const [id, setId] = useState(user)
  const [action, setAction] = useState("manual_award")
  const [points, setPoints] = useState<number | undefined>(10)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  )
  const request = useRef<{ fingerprint: string; id: string } | null>(null)
  const inFlight = useRef(false)
  useEffect(() => {
    setId(user)
  }, [user])
  const valid =
    !!id.trim() &&
    !!reason.trim() &&
    Number.isInteger(points) &&
    points! >= 1 &&
    points! <= 500
  const submit = async () => {
    if (!valid || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setMessage(null)
    const payload = {
      baUserId: id.trim(),
      action,
      points,
      reason: reason.trim(),
    }
    const fingerprint = JSON.stringify(payload)
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, id: crypto.randomUUID() }
    try {
      await put("/rewards/award", {
        ...payload,
        clientRequestId: request.current.id,
      })
      request.current = null
      setReason("")
      setReview(false)
      setMessage({
        ok: true,
        text: "Points updated. The adjustment is recorded in the history.",
      })
      onSuccess()
    } catch (error) {
      const detail = (
        error as { response?: { data?: { error?: { message?: string } } } }
      ).response?.data?.error?.message
      setMessage({
        ok: false,
        text:
          detail ??
          "Couldn’t confirm the adjustment. Retry with the same details to avoid applying it twice.",
      })
    } finally {
      setBusy(false)
      inFlight.current = false
    }
  }

  return (
    <Card title="Adjust a contributor’s points">
      <Flex direction="column" alignItems="stretch" gap={4}>
        <Typography textColor="neutral600">
          Use a manual adjustment for corrections. A reason is required and
          saved with your admin identity.
        </Typography>
        <Field.Root name="award-user" required>
          <Field.Label>Contributor ID</Field.Label>
          <TextInput
            value={id}
            maxLength={255}
            disabled={busy}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setId(event.target.value)
            }
          />
        </Field.Root>
        <Field.Root name="award-action">
          <Field.Label>Adjustment</Field.Label>
          <SingleSelect
            value={action}
            disabled={busy}
            onChange={(value) => setAction(String(value))}
          >
            <SingleSelectOption value="manual_award">
              Award points
            </SingleSelectOption>
            <SingleSelectOption value="manual_deduct">
              Deduct points
            </SingleSelectOption>
          </SingleSelect>
        </Field.Root>
        <Field.Root
          name="award-points"
          required
          hint="Whole numbers from 1 to 500."
        >
          <Field.Label>Points</Field.Label>
          <NumberInput
            value={points}
            min={1}
            max={500}
            step={1}
            disabled={busy}
            onValueChange={setPoints}
          />
          <Field.Hint />
        </Field.Root>
        <Field.Root name="award-reason" required>
          <Field.Label>Reason</Field.Label>
          <Textarea
            value={reason}
            maxLength={2000}
            disabled={busy}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
              setReason(event.target.value)
            }
          />
        </Field.Root>
        <Button
          disabled={!valid || busy}
          variant={action === "manual_deduct" ? "danger-light" : "default"}
          onClick={() => {
            setMessage(null)
            setReview(true)
          }}
        >
          Review adjustment
        </Button>
        {message && (
          <Typography
            tag="p"
            role={message.ok ? "status" : "alert"}
            textColor={message.ok ? "success600" : "danger600"}
          >
            {message.text}
          </Typography>
        )}
      </Flex>
      <Dialog.Root
        open={review}
        onOpenChange={(open) => {
          if (!busy) setReview(open)
        }}
      >
        <Dialog.Content>
          <Dialog.Header>Confirm points adjustment</Dialog.Header>
          <Dialog.Body>
            <Flex direction="column" alignItems="stretch" gap={4}>
              <Dialog.Description>
                {action === "manual_deduct" ? "Deduct" : "Award"} {points}{" "}
                points {action === "manual_deduct" ? "from" : "to"} {id}?
              </Dialog.Description>
              <Typography textColor="neutral600">{reason}</Typography>
              {message && !message.ok && (
                <Typography role="alert" textColor="danger600">
                  {message.text}
                </Typography>
              )}
            </Flex>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button
                variant="tertiary"
                disabled={busy}
                onClick={() => setReview(false)}
              >
                Cancel
              </Button>
            </Dialog.Cancel>
            <Button
              loading={busy}
              disabled={busy}
              variant={action === "manual_deduct" ? "danger" : "default"}
              onClick={() => void submit()}
            >
              Confirm adjustment
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Card>
  )
}
function Activity({ revision }: { revision: number }) {
  const result = useAdminResource<ChartData>("/chart-data", revision)
  const daily = result.data?.dailyPoints ?? []
  const actions = result.data?.actionBreakdown ?? []
  const max = Math.max(...daily.map((row) => row.points), 1)

  return (
    <Card title="Contribution activity">
      {result.error && <Failure retry={result.retry} />}
      {result.loading ? (
        <Typography>Loading activity…</Typography>
      ) : !daily.some((row) => row.points !== 0) &&
        !actions.length &&
        !result.error ? (
        <Typography textColor="neutral600">
          Activity will appear after the first accepted contribution.
        </Typography>
      ) : (
        <>
          {daily.length > 0 && (
            <>
              <Typography tag="p" textColor="neutral600" paddingBottom={4}>
                Points awarded over the last {daily.length} days
              </Typography>
              <Box color="primary600">
                <svg
                  viewBox="0 0 600 120"
                  style={{ width: "100%", height: "14rem" }}
                  role="img"
                  aria-label="Daily contribution points; values are also available in the data table below"
                >
                  {daily.map((row, index) => (
                    <rect
                      key={row.date}
                      x={index * (600 / daily.length)}
                      y={120 - Math.max(0, (row.points / max) * 110)}
                      width={Math.max(1, 600 / daily.length - 3)}
                      height={Math.max(0, (row.points / max) * 110)}
                      rx={2}
                      fill="currentColor"
                    >
                      <title>
                        {row.date}: {row.points} points
                      </title>
                    </rect>
                  ))}
                </svg>
              </Box>
              <details>
                <summary style={{ cursor: "pointer", padding: "1rem 0" }}>
                  View daily values
                </summary>
                <Table
                  colCount={2}
                  rowCount={daily.length}
                  aria-label="Daily points"
                >
                  <Thead>
                    <Tr>
                      <Th>
                        <Typography variant="sigma">Date</Typography>
                      </Th>
                      <Th>
                        <Typography variant="sigma">Points</Typography>
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {daily.map((row) => (
                      <Tr key={row.date}>
                        <Td>
                          <Typography>
                            {new Date(row.date).toLocaleDateString()}
                          </Typography>
                        </Td>
                        <Td>
                          <Typography>{row.points}</Typography>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </details>
            </>
          )}
          {actions.length > 0 && (
            <Box paddingTop={5}>
              <Typography tag="h3" variant="delta" paddingBottom={3}>
                Points by action
              </Typography>
              <Table
                colCount={3}
                rowCount={actions.length}
                aria-label="Action breakdown"
              >
                <Thead>
                  <Tr>
                    {["Action", "Events", "Points"].map((label) => (
                      <Th key={label}>
                        <Typography variant="sigma">{label}</Typography>
                      </Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {actions.map((row) => (
                    <Tr key={row.action}>
                      <Td>
                        <Typography>{actionLabel(row.action)}</Typography>
                      </Td>
                      <Td>
                        <Typography>{row.count}</Typography>
                      </Td>
                      <Td>
                        <Typography>{row.totalPoints}</Typography>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </>
      )}
    </Card>
  )
}

export function RewardsDashboard() {
  const loading = useAuth("Rewards", (state) => state.isLoading)
  const user = useAuth("Rewards", (state) => state.user)
  const permissions = useAuth("Rewards", (state) => state.permissions)
  if (loading) return <Page.Loading />

  return <ReadyRewards key={`${user?.id}:${JSON.stringify(permissions)}`} />
}
function ReadyRewards() {
  const { allowedActions, isLoading, error } = useRBAC(PERMISSIONS)
  const [revision, setRevision] = useState(0)
  const [user, setUser] = useState("")
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  if (isLoading) return <Page.Loading />
  if (error) return <Page.Error />
  if (!allowedActions.canRead) return <Page.NoPermissions />

  return (
    <PluginPage>
      <Layouts.Root>
        <Layouts.Header
          title="Rewards"
          subtitle="Understand contributor activity, review point history and manage adjustments."
          primaryAction={
            <Button variant="secondary" onClick={refresh}>
              Refresh
            </Button>
          }
        />
        <Layouts.Content>
          <Flex direction="column" alignItems="stretch" gap={6}>
            <Summary revision={revision} />
            <Flex gap={6} wrap="wrap" alignItems="flex-start">
              <Box style={{ flex: "2 1 48rem", minWidth: 0 }}>
                <Activity revision={revision} />
              </Box>
              {allowedActions.canAward && (
                <Box style={{ flex: "1 1 30rem", minWidth: 0 }}>
                  <ManualAward user={user} onSuccess={refresh} />
                </Box>
              )}
            </Flex>
            <EventLog
              revision={revision}
              canAward={!!allowedActions.canAward}
              onAward={(id) => {
                setUser(id)
                document
                  .querySelector<HTMLInputElement>('[name="award-user"]')
                  ?.focus()
              }}
            />
          </Flex>
        </Layouts.Content>
      </Layouts.Root>
    </PluginPage>
  )
}
function Summary({ revision }: { revision: number }) {
  const result = useAdminResource<Stats>("/stats", revision)

  return (
    <>
      {result.error && <Failure retry={result.retry} />}
      <Flex gap={5} wrap="wrap">
        {[
          ["Contributors", result.data?.totalContributors],
          ["Points this month", result.data?.pointsThisMonth],
        ].map(([label, value]) => (
          <Box
            key={label}
            style={{ flex: "1 1 24rem" }}
            background="neutral0"
            padding={6}
            hasRadius
            shadow="tableShadow"
          >
            <Typography tag="h2" variant="sigma" textColor="neutral600">
              {label}
            </Typography>
            <Typography
              tag="p"
              variant="alpha"
              paddingTop={3}
              textColor="neutral800"
            >
              {result.loading
                ? "…"
                : value === undefined
                  ? "Unavailable"
                  : Number(value).toLocaleString()}
            </Typography>
          </Box>
        ))}
      </Flex>
    </>
  )
}
