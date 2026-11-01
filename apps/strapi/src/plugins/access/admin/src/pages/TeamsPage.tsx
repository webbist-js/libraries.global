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
  Status,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"
import { ArrowClockwise, Eye, Plus } from "@strapi/icons"
import { EmptyDocuments } from "@strapi/icons/symbols"
import { Layouts, useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

import {
  PluginTable,
  PluginPage,
} from "../../../../../admin/components/PluginUI"
import { type AccessSection, PluginNav } from "../components/PluginNav"
import { TeamDetailModal } from "../components/TeamDetailModal"
import { TeamModal } from "../components/TeamModal"
import {
  apiError,
  dateCell,
  type Team,
  type TeamSummary,
} from "../components/teamsMeta"

/**
 * Teams: every Team organisation, newest first, with its seats, libraries
 * and whether an admin has verified it. Open one to manage its members;
 * create or edit one in the modal.
 */
export function TeamsPage({
  allowed,
}: {
  allowed?: Record<AccessSection, boolean>
}) {
  const { get } = useFetchClient()
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<TeamSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Team | null>(null)
  const [editing, setEditing] = useState<Team | null | "new">(null)

  const load = useCallback(
    async (q: string) => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await get(`/access/teams?q=${encodeURIComponent(q)}`)
        setRows((data as { data?: TeamSummary[] })?.data ?? [])
      } catch (err) {
        setError(
          apiError(
            err,
            "Teams couldn't be loaded. Check that you can manage teams."
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

  async function openTeam(documentId: string) {
    try {
      const { data } = await get(`/access/teams/${documentId}`)
      setOpen((data as { data: Team }).data)
    } catch (err) {
      setError(apiError(err, "The team couldn't be loaded."))
    }
  }

  return (
    <PluginPage>
      <Layouts.Root>
        <Layouts.Header
          title="Teams"
          subtitle="Team organisations: seats, libraries, verification and members."
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
              <Button startIcon={<Plus />} onClick={() => setEditing("new")}>
                New team
              </Button>
            </Flex>
          }
        />
        <Layouts.Content>
          <PluginNav current="teams" allowed={allowed} />
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
            <Box width="32rem" paddingBottom={4}>
              <Searchbar
                name="teams-search"
                size="S"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setQuery(e.target.value)
                }
                onClear={() => setQuery("")}
                clearLabel="Clear search"
                placeholder="Search teams by name"
              >
                Search teams
              </Searchbar>
            </Box>
            {loading && rows.length === 0 ? (
              <Flex justifyContent="center" padding={8}>
                <Loader>Loading teams</Loader>
              </Flex>
            ) : rows.length === 0 ? (
              <EmptyStateLayout
                icon={<EmptyDocuments width="10rem" />}
                content={
                  query.trim()
                    ? "No team matches that name."
                    : "No teams yet. Create one for a library service, verify it, then invite its organiser."
                }
                action={
                  <Button
                    startIcon={<Plus />}
                    onClick={() => setEditing("new")}
                  >
                    New team
                  </Button>
                }
              />
            ) : (
              <PluginTable colCount={6} rowCount={rows.length + 1}>
                <Thead>
                  <Tr>
                    <Th>
                      <Typography variant="sigma">Team</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Libraries</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Seats</Typography>
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
                  {rows.map((t) => (
                    <Tr key={t.documentId}>
                      <Td>
                        <Typography fontWeight="semiBold">{t.name}</Typography>
                        <Typography variant="pi" textColor="neutral600" tag="p">
                          {t.slug}
                        </Typography>
                      </Td>
                      <Td>
                        <Typography>
                          {t.libraries.length === 0
                            ? "None"
                            : t.libraries
                                .slice(0, 3)
                                .map((l) => l.name)
                                .join(", ") +
                              (t.libraries.length > 3
                                ? ` +${t.libraries.length - 3}`
                                : "")}
                        </Typography>
                      </Td>
                      <Td>
                        <Typography>
                          {t.used} of {t.seats}
                        </Typography>
                      </Td>
                      <Td>
                        <Flex gap={2}>
                          <Badge active={t.status === "active"}>
                            {t.status === "active" ? "Active" : "Lapsed"}
                          </Badge>
                          <Status
                            variant={t.verifiedAt ? "success" : "warning"}
                            size="S"
                          >
                            {t.verifiedAt ? "Verified" : "Unverified"}
                          </Status>
                        </Flex>
                      </Td>
                      <Td>
                        <Typography>{dateCell(t.expiresAt)}</Typography>
                      </Td>
                      <Td>
                        <IconButton
                          label={`Open ${t.name}`}
                          variant="ghost"
                          onClick={() => void openTeam(t.documentId)}
                        >
                          <Eye />
                        </IconButton>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </PluginTable>
            )}
          </Box>
        </Layouts.Content>
        {open && editing === null && (
          <TeamDetailModal
            team={open}
            onClose={() => setOpen(null)}
            onEdit={() => setEditing(open)}
            onChanged={(team) => {
              setOpen(team)
              void load(query.trim())
            }}
          />
        )}
        {editing !== null && (
          <TeamModal
            team={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={(team) => {
              setEditing(null)
              setOpen(team)
              void load(query.trim())
            }}
          />
        )}
      </Layouts.Root>
    </PluginPage>
  )
}
