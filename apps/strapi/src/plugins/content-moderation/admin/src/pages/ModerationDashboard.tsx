import {
  Alert,
  Badge,
  Box,
  Button,
  EmptyStateLayout,
  Flex,
  IconButton,
  Loader,
  Searchbar,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"
import { ArrowClockwise, Eye } from "@strapi/icons"
import { EmptyDocuments } from "@strapi/icons/symbols"
import { Layouts, useFetchClient, useNotification } from "@strapi/strapi/admin"
import { useCallback, useEffect, useMemo, useState } from "react"

import { ReviewModal, StatusPill, TypeBadge } from "../components/ReviewModal"
import {
  detailOf,
  type ModerationStatus,
  relativeTime,
  STATUS_TABS,
  type Submission,
  summaryOf,
  TYPE_LABELS,
} from "../components/submissionMeta"
import { SuggestionsPanel } from "../components/SuggestionsPanel"

type Decision = "approved" | "rejected" | "needs_info"

/**
 * The moderation queue: one tab per status, a filterable table of
 * submissions, and a review dialog that shows everything a moderator needs
 * before approving, rejecting or asking for more information.
 */
export function ModerationDashboard() {
  const { get, put } = useFetchClient()
  const { toggleNotification } = useNotification()
  const [byStatus, setByStatus] = useState<
    Partial<Record<ModerationStatus, Submission[]>>
  >({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<ModerationStatus>("pending")
  const [typeFilter, setTypeFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<string>("pending")
  const [openSuggestions, setOpenSuggestions] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(
        STATUS_TABS.map(async (tab) => {
          const { data } = await get(
            `/content-moderation/submissions?status=${tab.id}`
          )
          const items = Array.isArray((data as { data?: unknown })?.data)
            ? (data as { data: Submission[] }).data
            : []

          return [tab.id, items] as const
        })
      )
      setByStatus(Object.fromEntries(results))
    } catch (err) {
      setError(
        "The queue couldn't be loaded. Check that you have the moderation permission and try again."
      )
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => {
    void load()
  }, [load])

  const decide = useCallback(
    async (
      id: string,
      next: Decision,
      reviewNote?: string
    ): Promise<boolean> => {
      try {
        await put(`/content-moderation/submissions/${id}/status`, {
          status: next,
          reviewNote,
        })
        toggleNotification({
          type: "success",
          message:
            next === "approved"
              ? "Approved and applied."
              : next === "rejected"
                ? "Rejected. The contributor has been told why."
                : "Sent back for more information.",
        })
        void load()

        return true
      } catch (err) {
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ??
          "The decision couldn't be saved."
        toggleNotification({ type: "danger", message })
        console.error(err)

        return false
      }
    },
    [put, load, toggleNotification]
  )

  const current = byStatus[status] ?? []
  const types = useMemo(
    () => Array.from(new Set(current.map((s) => s.submissionType))),
    [current]
  )
  const q = query.trim().toLowerCase()
  const rows = current.filter(
    (s) =>
      (typeFilter === "all" || s.submissionType === typeFilter) &&
      (!q ||
        [
          summaryOf(s),
          s.submittedByEmail,
          s.submittedByName ?? "",
          s.targetSlug ?? "",
          detailOf(s) ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q))
  )
  const open = openId
    ? (Object.values(byStatus)
        .flat()
        .find((s) => s?.documentId === openId) ?? null)
    : null
  const pendingCount = byStatus.pending?.length ?? 0

  return (
    <Layouts.Root>
      <Layouts.Header
        title="Moderation queue"
        subtitle={
          loading
            ? "Loading submissions…"
            : `${pendingCount} waiting for review · ${byStatus.needs_info?.length ?? 0} waiting on contributors`
        }
        primaryAction={
          <Button
            variant="secondary"
            startIcon={<ArrowClockwise />}
            onClick={() => void load()}
            loading={loading}
          >
            Refresh
          </Button>
        }
      />
      <Layouts.Content>
        {error && (
          <Box paddingBottom={4}>
            <Alert
              variant="danger"
              title="Couldn't load"
              closeLabel="Dismiss"
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          </Box>
        )}
        <Tabs.Root
          value={tab}
          onValueChange={(v) => {
            setTab(v)
            if (v !== "suggestions") {
              setStatus(v as ModerationStatus)
              setTypeFilter("all")
            }
          }}
        >
          <Tabs.List aria-label="Submission status">
            {STATUS_TABS.map((tab) => (
              <Tabs.Trigger key={tab.id} value={tab.id}>
                <Flex gap={2} alignItems="center">
                  {tab.label}
                  {(byStatus[tab.id]?.length ?? 0) > 0 && (
                    <Badge size="S" active={tab.id === "pending"}>
                      {byStatus[tab.id]!.length}
                    </Badge>
                  )}
                </Flex>
              </Tabs.Trigger>
            ))}
            <Tabs.Trigger value="suggestions">
              <Flex gap={2} alignItems="center">
                Suggestions
                {openSuggestions > 0 && (
                  <Badge size="S">{openSuggestions}</Badge>
                )}
              </Flex>
            </Tabs.Trigger>
          </Tabs.List>
          {STATUS_TABS.map((tab) => (
            <Tabs.Content key={tab.id} value={tab.id}>
              <Box
                background="neutral0"
                padding={6}
                hasRadius
                shadow="tableShadow"
              >
                <Flex gap={3} paddingBottom={4} wrap="wrap" alignItems="center">
                  <Box width="28rem">
                    <Searchbar
                      name="queue-search"
                      size="S"
                      value={query}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setQuery(e.target.value)
                      }
                      onClear={() => setQuery("")}
                      clearLabel="Clear search"
                      placeholder="Search by title, target or contributor"
                    >
                      Search submissions
                    </Searchbar>
                  </Box>
                  <Box width="20rem">
                    <SingleSelect
                      aria-label="Submission type"
                      size="S"
                      value={typeFilter}
                      onChange={(v) => setTypeFilter(String(v))}
                    >
                      <SingleSelectOption value="all">
                        All types
                      </SingleSelectOption>
                      {types.map((t) => (
                        <SingleSelectOption key={t} value={t}>
                          {TYPE_LABELS[t] ?? t}
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                  </Box>
                  <Typography variant="pi" textColor="neutral600">
                    {rows.length} of {current.length} {tab.label.toLowerCase()}
                  </Typography>
                </Flex>

                {loading ? (
                  <Flex justifyContent="center" padding={8}>
                    <Loader>Loading submissions</Loader>
                  </Flex>
                ) : rows.length === 0 ? (
                  <EmptyStateLayout
                    icon={<EmptyDocuments width="16rem" />}
                    content={
                      current.length === 0
                        ? `Nothing ${tab.label.toLowerCase()} right now.`
                        : "Nothing matches these filters."
                    }
                    action={
                      current.length > 0 ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setQuery("")
                            setTypeFilter("all")
                          }}
                        >
                          Clear filters
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <Table colCount={6} rowCount={rows.length + 1}>
                    <Thead>
                      <Tr>
                        <Th>
                          <Typography variant="sigma">Type</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Submission</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Contributor</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Submitted</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Status</Typography>
                        </Th>
                        <Th>
                          <Typography
                            variant="sigma"
                            style={{
                              position: "absolute",
                              clip: "rect(0 0 0 0)",
                            }}
                          >
                            Actions
                          </Typography>
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {rows.map((sub) => {
                        const detail = detailOf(sub)

                        return (
                          <Tr
                            key={sub.documentId}
                            onClick={() => setOpenId(sub.documentId)}
                            style={{ cursor: "pointer" }}
                          >
                            <Td>
                              <TypeBadge type={sub.submissionType} />
                            </Td>
                            <Td>
                              <Flex
                                direction="column"
                                alignItems="flex-start"
                                gap={0}
                              >
                                <Typography
                                  fontWeight="semiBold"
                                  textColor="neutral800"
                                >
                                  {summaryOf(sub)}
                                </Typography>
                                {detail && (
                                  <Typography
                                    variant="pi"
                                    textColor="neutral600"
                                  >
                                    {detail}
                                  </Typography>
                                )}
                              </Flex>
                            </Td>
                            <Td>
                              <Flex
                                direction="column"
                                alignItems="flex-start"
                                gap={0}
                              >
                                <Typography textColor="neutral800">
                                  {sub.submittedByName ?? sub.submittedByEmail}
                                </Typography>
                                {sub.submittedByName && (
                                  <Typography
                                    variant="pi"
                                    textColor="neutral600"
                                  >
                                    {sub.submittedByEmail}
                                  </Typography>
                                )}
                              </Flex>
                            </Td>
                            <Td>
                              <Typography
                                textColor="neutral800"
                                title={sub.createdAt}
                              >
                                {relativeTime(sub.createdAt)}
                              </Typography>
                            </Td>
                            <Td>
                              <StatusPill status={sub.status} />
                            </Td>
                            <Td>
                              <Flex justifyContent="flex-end">
                                <IconButton
                                  label="Review"
                                  variant="ghost"
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    setOpenId(sub.documentId)
                                  }}
                                >
                                  <Eye />
                                </IconButton>
                              </Flex>
                            </Td>
                          </Tr>
                        )
                      })}
                    </Tbody>
                  </Table>
                )}
              </Box>
            </Tabs.Content>
          ))}
          {/* Mounted up front so the tab badge shows the open count. */}
          <Tabs.Content
            value="suggestions"
            forceMount
            hidden={tab !== "suggestions"}
          >
            <SuggestionsPanel onOpenCount={setOpenSuggestions} />
          </Tabs.Content>
        </Tabs.Root>
      </Layouts.Content>
      <ReviewModal
        sub={open}
        onClose={() => setOpenId(null)}
        onDecide={decide}
      />
    </Layouts.Root>
  )
}
