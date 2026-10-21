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
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"
import { ArrowClockwise, Eye } from "@strapi/icons"
import { EmptyDocuments } from "@strapi/icons/symbols"
import { Layouts, useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

import { PluginPage } from "../../../../../admin/components/PluginUI"
import {
  errorMessage,
  nameOf,
  type PersonRow,
  ROLE_LABELS,
} from "../components/peopleMeta"
import { PersonModal } from "../components/PersonModal"
import { type AccessSection, PluginNav } from "../components/PluginNav"

/**
 * People: find a contributor by name, username or the email their
 * submissions came from, then see and change their Role Grants. With no
 * search, the people who most recently got a role.
 */
export function PeoplePage({
  allowed,
}: {
  allowed?: Record<AccessSection, boolean>
}) {
  const { get } = useFetchClient()
  const [query, setQuery] = useState("")
  const [searched, setSearched] = useState("")
  const [rows, setRows] = useState<PersonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(
    async (q: string) => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await get(`/access/people?q=${encodeURIComponent(q)}`)
        setRows((data as { data?: PersonRow[] })?.data ?? [])
        setSearched(q)
      } catch (err) {
        setError(
          errorMessage(
            err,
            "People couldn't be loaded. Check that you can manage contributor roles."
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

  // Searches as the admin types, after a short pause.
  useEffect(() => {
    const q = query.trim()
    if (q === searched) return
    const t = setTimeout(() => void load(q), 350)

    return () => clearTimeout(t)
  }, [query, searched, load])

  return (
    <PluginPage>
      <Layouts.Root>
        <Layouts.Header
          title="People"
          subtitle="Contributor roles: find someone, see their roles, add or revoke one."
          primaryAction={
            <Button
              variant="secondary"
              startIcon={<ArrowClockwise />}
              onClick={() => void load(query.trim())}
              loading={loading}
            >
              Refresh
            </Button>
          }
        />
        <Layouts.Content>
          <PluginNav current="people" allowed={allowed} />
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
          <Box background="neutral0" padding={6} hasRadius shadow="tableShadow">
            <Flex gap={3} paddingBottom={4} wrap="wrap" alignItems="center">
              <Box width="32rem">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void load(query.trim())
                  }}
                >
                  <Searchbar
                    name="people-search"
                    size="S"
                    value={query}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setQuery(e.target.value)
                    }
                    onClear={() => setQuery("")}
                    clearLabel="Clear search"
                    placeholder="Search by name, username or email"
                  >
                    Search people
                  </Searchbar>
                </form>
              </Box>
              <Typography
                variant="pi"
                textColor="neutral600"
                aria-live="polite"
              >
                {loading
                  ? "Searching…"
                  : searched
                    ? `${rows.length} ${rows.length === 1 ? "person" : "people"} found`
                    : `${rows.length} with a role, most recent first`}
              </Typography>
            </Flex>

            {loading && rows.length === 0 ? (
              <Flex justifyContent="center" padding={8}>
                <Loader>Loading people</Loader>
              </Flex>
            ) : rows.length === 0 ? (
              <EmptyStateLayout
                icon={<EmptyDocuments width="16rem" />}
                content={
                  searched
                    ? "Nobody matches that search."
                    : "Nobody has a role yet. Search for someone to add one."
                }
              />
            ) : (
              <Table colCount={5} rowCount={rows.length + 1}>
                <Thead>
                  <Tr>
                    <Th>
                      <Typography variant="sigma">Person</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Email</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Role</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Active roles</Typography>
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
                  {rows.map((p) => (
                    <Tr
                      key={p.baUserId}
                      onClick={() => setOpenId(p.baUserId)}
                      style={{ cursor: "pointer" }}
                    >
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
                            {nameOf(p)}
                          </Typography>
                          {p.displayName && p.username && (
                            <Typography variant="pi" textColor="neutral600">
                              @{p.username}
                            </Typography>
                          )}
                        </Flex>
                      </Td>
                      <Td>
                        <Typography textColor="neutral800">
                          {p.email ?? "—"}
                        </Typography>
                      </Td>
                      <Td>
                        <Badge active={p.contributorRole !== "reader"}>
                          {ROLE_LABELS[p.contributorRole] ?? p.contributorRole}
                        </Badge>
                      </Td>
                      <Td>
                        <Typography textColor="neutral800">
                          {p.activeGrants}
                        </Typography>
                      </Td>
                      <Td>
                        <Flex justifyContent="flex-end">
                          <IconButton
                            label={`Open ${nameOf(p)}`}
                            variant="ghost"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation()
                              setOpenId(p.baUserId)
                            }}
                          >
                            <Eye />
                          </IconButton>
                        </Flex>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Box>
        </Layouts.Content>
        <PersonModal
          baUserId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => void load(searched)}
        />
      </Layouts.Root>
    </PluginPage>
  )
}
