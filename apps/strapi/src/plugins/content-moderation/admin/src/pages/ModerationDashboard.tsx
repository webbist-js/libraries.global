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
import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

import {
  PluginTable,
  PluginPage,
} from "../../../../../admin/components/PluginUI"
import { ReviewModal, StatusPill, TypeBadge } from "../components/ReviewModal"
import {
  articleDecisionErrorMessage,
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
 * before approving, rejecting or asking for more information. `?type=`
 * preselects the type filter (People links here with `role_application`).
 */
export function ModerationDashboard() {
  const { get, put } = useFetchClient()
  const [searchParams] = useSearchParams()
  const { toggleNotification } = useNotification()
  const [rows, setRows] = useState<Submission[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const generation = useRef(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<ModerationStatus>("pending")
  const [typeFilter, setTypeFilter] = useState(
    () => searchParams.get("type") || "all"
  )
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<string>("pending")
  const [openSuggestions, setOpenSuggestions] = useState(0)

  const load = useCallback(async () => {
    const request = ++generation.current
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
        pageSize: "50",
        q: query,
      })
      if (typeFilter !== "all") params.set("type", typeFilter)
      const { data } = await get(`/content-moderation/submissions?${params}`)
      const result = data as {
        data: Submission[]
        meta: { total: number; counts: Record<string, number> }
      }
      if (!Array.isArray(result.data) || !result.meta)
        throw new Error("Invalid queue response")
      if (request !== generation.current) return
      setRows(result.data)
      setCounts(result.meta.counts)
      setTotal(result.meta.total)
    } catch {
      if (request === generation.current)
        setError(
          "The queue couldn't be loaded. Check your moderation permission and try again."
        )
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [get, status, page, query, typeFilter])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 200)

    return () => {
      clearTimeout(timer)
      generation.current++
    }
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
          articleDecisionErrorMessage(
            (err as { response?: { data?: unknown } })?.response?.data
          ) ??
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

  const types = Object.keys(TYPE_LABELS)
  const open = rows.find((row) => row.documentId === openId) ?? null
  const pendingCount = counts.pending ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 50))

  return (
    <PluginPage>
      <Layouts.Root>
        <Layouts.Header
          title="Moderation queue"
          subtitle={
            loading
              ? "Loading submissions…"
              : `${pendingCount} waiting for review · ${counts.needs_info ?? 0} waiting on contributors`
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
                setPage(1)
                setOpenId(null)
              }
            }}
          >
            <Box
              color="neutral500"
              style={{
                overflowX: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: "currentColor transparent",
              }}
            >
              <Tabs.List
                aria-label="Submission status"
                style={{ minWidth: "max-content", whiteSpace: "nowrap" }}
              >
                {STATUS_TABS.map((tab) => (
                  <Tabs.Trigger key={tab.id} value={tab.id}>
                    <Flex gap={2} alignItems="center">
                      {tab.label}
                      {(counts[tab.id] ?? 0) > 0 && (
                        <Badge size="S" active={tab.id === "pending"}>
                          {counts[tab.id]}
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
            </Box>
            {STATUS_TABS.map((tab) => (
              <Tabs.Content key={tab.id} value={tab.id}>
                <Box
                  background="neutral0"
                  padding={6}
                  hasRadius
                  shadow="tableShadow"
                >
                  <Flex
                    gap={3}
                    paddingBottom={4}
                    wrap="wrap"
                    alignItems="center"
                  >
                    <Box width="28rem">
                      <Searchbar
                        name="queue-search"
                        size="S"
                        value={query}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setQuery(e.target.value)
                          setPage(1)
                        }}
                        onClear={() => {
                          setQuery("")
                          setPage(1)
                        }}
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
                        onChange={(v) => {
                          setTypeFilter(String(v))
                          setPage(1)
                        }}
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
                      {total === 0 ? 0 : (page - 1) * 50 + 1}–
                      {(page - 1) * 50 + rows.length} of {total}{" "}
                      {tab.label.toLowerCase()}
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
                        !query && typeFilter === "all"
                          ? `Nothing ${tab.label.toLowerCase()} right now.`
                          : "Nothing matches these filters."
                      }
                      action={
                        !!query || typeFilter !== "all" ? (
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
                    <PluginTable colCount={6} rowCount={rows.length + 1}>
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
                                {sub.staffReviewHint && (
                                  <Badge size="S">{sub.staffReviewHint}</Badge>
                                )}
                              </Td>
                              <Td>
                                <Flex
                                  direction="column"
                                  alignItems="flex-start"
                                  gap={1}
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
                                  gap={1}
                                >
                                  <Typography textColor="neutral800">
                                    {sub.submittedByName ??
                                      sub.submittedByEmail}
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
                    </PluginTable>
                  )}
                  {pageCount > 1 && (
                    <Flex justifyContent="space-between" paddingTop={4} gap={3}>
                      <Button
                        variant="secondary"
                        disabled={loading || page <= 1}
                        onClick={() => setPage((value) => value - 1)}
                      >
                        Previous
                      </Button>
                      <Typography textColor="neutral600">
                        Page {page} of {pageCount}
                      </Typography>
                      <Button
                        variant="secondary"
                        disabled={loading || page >= pageCount}
                        onClick={() => setPage((value) => value + 1)}
                      >
                        Next
                      </Button>
                    </Flex>
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
    </PluginPage>
  )
}
