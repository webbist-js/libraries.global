import {
  Box,
  Button,
  Field,
  Flex,
  NumberInput,
  Table,
  Tbody,
  Td,
  TextInput,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"
import { useEffect, useState } from "react"

type Event = {
  id: number
  baUserId: string
  action: string
  points: number
  awardedAt: string
  metadata: Record<string, unknown> | null
}

type Stats = {
  totalContributors: number
  pointsThisMonth: number
}

const TABS = ["Overview", "Event Log", "Manual Award"] as const
type Tab = (typeof TABS)[number]

function useAdminFetch<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/rewards${path}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setData(json.data as T)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading }
}

function OverviewTab() {
  const { data: stats, loading } = useAdminFetch<Stats>("/stats")

  if (loading)
    return (
      <Box padding={6}>
        <Typography>Loading…</Typography>
      </Box>
    )

  return (
    <Box padding={6}>
      <Flex gap={6} marginBottom={6}>
        <Box
          padding={4}
          background="neutral100"
          borderColor="neutral200"
          hasRadius
        >
          <Typography variant="sigma" textColor="neutral600">
            Total contributors
          </Typography>
          <Typography variant="alpha">
            {stats?.totalContributors ?? 0}
          </Typography>
        </Box>
        <Box
          padding={4}
          background="neutral100"
          borderColor="neutral200"
          hasRadius
        >
          <Typography variant="sigma" textColor="neutral600">
            Points awarded this month
          </Typography>
          <Typography variant="alpha">{stats?.pointsThisMonth ?? 0}</Typography>
        </Box>
      </Flex>
    </Box>
  )
}

function EventLogTab() {
  const [page, setPage] = useState(1)
  const [filterUser, setFilterUser] = useState("")
  const [filterAction, setFilterAction] = useState("")
  const [queryKey, setQueryKey] = useState(0)

  const path = `/events?page=${page}${filterUser ? `&baUserId=${filterUser}` : ""}${filterAction ? `&action=${filterAction}` : ""}`
  const { data, loading } = useAdminFetch<{
    events: Event[]
    meta: { total: number }
  }>(path, [queryKey, page])

  const events: Event[] = Array.isArray(data)
    ? (data as unknown as Event[])
    : []

  return (
    <Box padding={6}>
      <Flex gap={4} marginBottom={4}>
        <Field.Root>
          <Field.Label>User ID</Field.Label>
          <TextInput
            value={filterUser}
            onChange={(e: any) => setFilterUser(e.target.value)}
            placeholder="baUserId"
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Action</Field.Label>
          <TextInput
            value={filterAction}
            onChange={(e: any) => setFilterAction(e.target.value)}
            placeholder="e.g. new_library_approved"
          />
        </Field.Root>
        <Box paddingTop={5}>
          <Button onClick={() => setQueryKey((k) => k + 1)}>Filter</Button>
        </Box>
      </Flex>

      {loading ? (
        <Typography>Loading…</Typography>
      ) : (
        <Table colCount={5} rowCount={events.length}>
          <Thead>
            <Tr>
              <Th>
                <Typography variant="sigma">User ID</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Action</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Points</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Awarded At</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Metadata</Typography>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {events.map((ev) => (
              <Tr key={ev.id}>
                <Td>
                  <Typography>{ev.baUserId}</Typography>
                </Td>
                <Td>
                  <Typography>{ev.action}</Typography>
                </Td>
                <Td>
                  <Typography
                    textColor={ev.points < 0 ? "danger600" : "success600"}
                  >
                    {ev.points > 0 ? "+" : ""}
                    {ev.points}
                  </Typography>
                </Td>
                <Td>
                  <Typography>
                    {new Date(ev.awardedAt).toLocaleString()}
                  </Typography>
                </Td>
                <Td>
                  <Typography variant="pi" textColor="neutral500">
                    {ev.metadata
                      ? JSON.stringify(ev.metadata).slice(0, 60)
                      : "—"}
                  </Typography>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Flex gap={2} marginTop={4}>
        <Button
          variant="tertiary"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <Typography paddingTop={2}>Page {page}</Typography>
        <Button variant="tertiary" onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </Flex>
    </Box>
  )
}

function ManualAwardTab() {
  const [baUserId, setBaUserId] = useState("")
  const [action, setAction] = useState<"manual_award" | "manual_deduct">(
    "manual_award"
  )
  const [points, setPoints] = useState(10)
  const [reason, setReason] = useState("")
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle")

  const submit = async () => {
    if (!baUserId || !reason || !points) return
    setStatus("loading")
    try {
      const res = await fetch("/rewards/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ baUserId, action, points, reason }),
      })
      setStatus(res.ok ? "success" : "error")
    } catch {
      setStatus("error")
    }
  }

  return (
    <Box padding={6} maxWidth="480px">
      <Flex direction="column" gap={4}>
        <Field.Root>
          <Field.Label>User ID (baUserId)</Field.Label>
          <TextInput
            value={baUserId}
            onChange={(e: any) => setBaUserId(e.target.value)}
            placeholder="better-auth user ID"
          />
        </Field.Root>

        <Field.Root>
          <Field.Label>Action</Field.Label>
          <Flex gap={2}>
            <Button
              variant={action === "manual_award" ? "default" : "tertiary"}
              onClick={() => setAction("manual_award")}
            >
              Award
            </Button>
            <Button
              variant={action === "manual_deduct" ? "danger" : "tertiary"}
              onClick={() => setAction("manual_deduct")}
            >
              Deduct
            </Button>
          </Flex>
        </Field.Root>

        <Field.Root>
          <Field.Label>Points</Field.Label>
          <NumberInput
            value={points}
            onValueChange={(v: number) => setPoints(v)}
          />
        </Field.Root>

        <Field.Root>
          <Field.Label>Reason (required)</Field.Label>
          <TextInput
            value={reason}
            onChange={(e: any) => setReason(e.target.value)}
            placeholder="Why is this award/deduction being made?"
          />
        </Field.Root>

        <Button
          loading={status === "loading"}
          disabled={!baUserId || !reason || !points}
          variant={action === "manual_deduct" ? "danger" : "default"}
          onClick={submit}
        >
          {action === "manual_award" ? "Award Points" : "Deduct Points"}
        </Button>

        {status === "success" && (
          <Typography textColor="success600">Done — points updated.</Typography>
        )}
        {status === "error" && (
          <Typography textColor="danger600">
            Something went wrong. Check the server logs.
          </Typography>
        )}
      </Flex>
    </Box>
  )
}

export function RewardsDashboard() {
  const [tab, setTab] = useState<Tab>("Overview")

  return (
    <Box padding={6}>
      <Box marginBottom={6}>
        <Typography variant="alpha">Rewards</Typography>
        <Typography textColor="neutral500">
          Points, tiers, badges and leaderboard management.
        </Typography>
      </Box>

      <Flex gap={2} marginBottom={4}>
        {TABS.map((t) => (
          <Button
            key={t}
            variant={tab === t ? "default" : "tertiary"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </Flex>

      {tab === "Overview" && <OverviewTab />}
      {tab === "Event Log" && <EventLogTab />}
      {tab === "Manual Award" && <ManualAwardTab />}
    </Box>
  )
}
