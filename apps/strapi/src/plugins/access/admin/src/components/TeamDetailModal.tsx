import {
  Badge,
  Box,
  Button,
  Dialog,
  Divider,
  Field,
  Flex,
  IconButton,
  Modal,
  SingleSelect,
  SingleSelectOption,
  Status,
  TextInput,
  Typography,
} from "@strapi/design-system"
import { Pencil, Plus, Trash } from "@strapi/icons"
import { useFetchClient, useNotification } from "@strapi/strapi/admin"
import { useState } from "react"

import {
  apiError,
  dateCell,
  memberLabel,
  STAFF_ROLE_LABELS,
  type Team,
  TEAM_ROLE_LABELS,
  type TeamMember,
} from "./teamsMeta"
import {
  PluginModalContent,
  FormGrid,
  MemberCard,
} from "../../../../../admin/components/PluginUI"

const NONE = "__none__"

/**
 * One Team: its facts, members with their team role, status and
 * per-library assignments, an invite form (with an optional
 * pre-assignment), assign/unassign per library and removal.
 */
export function TeamDetailModal({
  team,
  onClose,
  onEdit,
  onChanged,
}: {
  team: Team
  onClose: () => void
  onEdit: () => void
  onChanged: (team: Team) => void
}) {
  const { get, post, put, del } = useFetchClient()
  const { toggleNotification } = useNotification()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [teamRole, setTeamRole] = useState<"organiser" | "member">("member")
  const [preLibrary, setPreLibrary] = useState(NONE)
  const [preRole, setPreRole] = useState<"owner" | "editor">("editor")
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const [assignFor, setAssignFor] = useState<Record<string, string>>({})
  const [assignRole, setAssignRole] = useState<
    Record<string, "owner" | "editor">
  >({})

  async function refresh() {
    const { data } = await get(`/access/teams/${team.documentId}`)
    onChanged((data as { data: Team }).data)
  }

  async function run(label: string, work: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await work()
      await refresh()
      toggleNotification({ type: "success", message: label })

      return true
    } catch (err) {
      setError(apiError(err, "The change couldn't be saved."))

      return false
    } finally {
      setBusy(false)
    }
  }

  const invite = () =>
    run("Invite sent.", async () => {
      await post(`/access/teams/${team.documentId}/members`, {
        email: email.trim(),
        teamRole,
        ...(preLibrary !== NONE
          ? { preassign: { libraryDocumentId: preLibrary, staffRole: preRole } }
          : {}),
      })
      setEmail("")
      setPreLibrary(NONE)
    })

  const libraryName = (id: string) =>
    team.libraries.find((l) => l.documentId === id)?.name ?? "Library"

  return (
    <>
      <Modal.Root open onOpenChange={(open) => !open && onClose()}>
        <PluginModalContent>
          <Modal.Header>
            <Flex gap={2} alignItems="center">
              <Modal.Title>{team.name}</Modal.Title>
              <Badge active={team.status === "active"}>
                {team.status === "active" ? "Active" : "Lapsed"}
              </Badge>
              {team.verifiedAt ? (
                <Status variant="success" size="S">
                  Verified
                </Status>
              ) : (
                <Status variant="warning" size="S">
                  Unverified
                </Status>
              )}
            </Flex>
          </Modal.Header>
          <Modal.Body>
            <Flex direction="column" alignItems="stretch" gap={5}>
              <FormGrid
                style={{
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
                }}
              >
                <Fact
                  label="Seats"
                  value={`${team.used} of ${team.seats} used`}
                />
                <Fact label="Expires" value={dateCell(team.expiresAt)} />
                <Fact
                  label="Source"
                  value={team.source === "checkout" ? "Checkout" : "Admin"}
                />
                <Fact label="Created" value={dateCell(team.createdAt)} />
                <Fact
                  label="Organisers"
                  value={team.organiserNames.join(", ") || "None yet"}
                />
              </FormGrid>
              <Box>
                <Typography variant="sigma" textColor="neutral600">
                  Libraries ({team.libraries.length})
                </Typography>
                <Typography variant="omega" tag="p">
                  {team.libraries.map((l) => l.name).join(" · ") ||
                    "None: edit the team to add some."}
                </Typography>
              </Box>
              {team.notes && (
                <Box>
                  <Typography variant="sigma" textColor="neutral600">
                    Notes
                  </Typography>
                  <Typography variant="omega" tag="p">
                    {team.notes}
                  </Typography>
                </Box>
              )}
              <Divider />
              <Typography variant="beta" tag="h3">
                Members ({team.members.length})
              </Typography>
              {error && (
                <Typography variant="pi" textColor="danger600" role="alert">
                  {error}
                </Typography>
              )}
              <Box
                tag="ul"
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: 16,
                }}
              >
                {team.members.length === 0 ? (
                  <Typography tag="li" textColor="neutral600">
                    No members yet. Invite an organiser to get started.
                  </Typography>
                ) : null}
                {team.members.map((m) => (
                  <MemberCard
                    tag="li"
                    key={m.documentId}
                    background="neutral0"
                    borderColor="neutral200"
                    padding={5}
                    hasRadius
                  >
                    <Box data-member-slot="person" style={{ minWidth: 0 }}>
                      <Typography fontWeight="semiBold">
                        {memberLabel(m)}
                      </Typography>
                      {m.name && (
                        <Typography variant="pi" textColor="neutral600" tag="p">
                          {m.email}
                        </Typography>
                      )}
                    </Box>
                    <Box data-member-slot="role" style={{ minWidth: 0 }}>
                      <Typography
                        tag="p"
                        variant="pi"
                        textColor="neutral600"
                        paddingBottom={2}
                      >
                        Team role
                      </Typography>
                      <SingleSelect
                        size="S"
                        aria-label={`Team role for ${memberLabel(m)}`}
                        value={m.teamRole}
                        disabled={busy}
                        onChange={(v) =>
                          void run("Team role changed.", () =>
                            put(
                              `/access/teams/${team.documentId}/members/${m.documentId}`,
                              { teamRole: String(v) }
                            )
                          )
                        }
                      >
                        {Object.entries(TEAM_ROLE_LABELS).map(([id, label]) => (
                          <SingleSelectOption key={id} value={id}>
                            {label}
                          </SingleSelectOption>
                        ))}
                      </SingleSelect>
                    </Box>
                    <Box
                      data-member-slot="status"
                      style={{ minWidth: 0, justifySelf: "start" }}
                    >
                      {m.status === "active" ? (
                        <Status variant="success" size="S">
                          Active · {dateCell(m.acceptedAt)}
                        </Status>
                      ) : (
                        <Status variant="secondary" size="S">
                          Invited · {dateCell(m.invitedAt)}
                        </Status>
                      )}
                    </Box>
                    <Box data-member-slot="libraries" style={{ minWidth: 0 }}>
                      <Flex direction="column" alignItems="flex-start" gap={1}>
                        {!m.assignments.length &&
                        !m.pending.length &&
                        !m.preassign ? (
                          <Typography variant="pi" textColor="neutral600">
                            No libraries assigned
                          </Typography>
                        ) : null}
                        {m.assignments.map((a) => (
                          <Flex
                            key={a.affiliationDocumentId}
                            gap={1}
                            alignItems="center"
                          >
                            <Typography variant="pi">
                              {libraryName(a.libraryDocumentId)} ·{" "}
                              {STAFF_ROLE_LABELS[a.staffRole]}
                            </Typography>
                            <IconButton
                              label={`Unassign from ${libraryName(a.libraryDocumentId)}`}
                              variant="ghost"
                              size="S"
                              disabled={busy}
                              onClick={() =>
                                void run("Unassigned.", () =>
                                  post(
                                    `/access/teams/${team.documentId}/unassign`,
                                    {
                                      memberId: m.documentId,
                                      libraryDocumentId: a.libraryDocumentId,
                                    }
                                  )
                                )
                              }
                            >
                              <Trash />
                            </IconButton>
                          </Flex>
                        ))}
                        {m.pending.map((p) => (
                          <Typography
                            key={p.submissionDocumentId}
                            variant="pi"
                            textColor="warning600"
                          >
                            {libraryName(p.libraryDocumentId)} ·{" "}
                            {STAFF_ROLE_LABELS[p.staffRole]} · waiting for a
                            Moderator
                          </Typography>
                        ))}
                        {m.status === "invited" && m.preassign && (
                          <Typography variant="pi" textColor="neutral600">
                            On acceptance:{" "}
                            {libraryName(m.preassign.libraryDocumentId)} ·{" "}
                            {STAFF_ROLE_LABELS[m.preassign.staffRole]}
                          </Typography>
                        )}
                        {m.status === "active" && team.libraries.length > 0 && (
                          <Flex gap={1} alignItems="center" wrap="wrap">
                            <SingleSelect
                              size="S"
                              aria-label={`Library to assign ${memberLabel(m)} to`}
                              placeholder="Assign to…"
                              value={assignFor[m.documentId] ?? ""}
                              onChange={(v) =>
                                setAssignFor({
                                  ...assignFor,
                                  [m.documentId]: String(v),
                                })
                              }
                            >
                              {team.libraries.map((l) => (
                                <SingleSelectOption
                                  key={l.documentId}
                                  value={l.documentId}
                                >
                                  {l.name}
                                </SingleSelectOption>
                              ))}
                            </SingleSelect>
                            <SingleSelect
                              size="S"
                              aria-label={`Level for ${memberLabel(m)}`}
                              value={assignRole[m.documentId] ?? "editor"}
                              onChange={(v) =>
                                setAssignRole({
                                  ...assignRole,
                                  [m.documentId]:
                                    v === "owner" ? "owner" : "editor",
                                })
                              }
                            >
                              <SingleSelectOption value="editor">
                                Editor
                              </SingleSelectOption>
                              <SingleSelectOption value="owner">
                                Owner
                              </SingleSelectOption>
                            </SingleSelect>
                            <Button
                              size="S"
                              variant="secondary"
                              startIcon={<Plus />}
                              disabled={busy || !assignFor[m.documentId]}
                              onClick={() =>
                                void run(
                                  team.verifiedAt
                                    ? "Assigned."
                                    : "Claim filed for a Moderator.",
                                  () =>
                                    post(
                                      `/access/teams/${team.documentId}/assign`,
                                      {
                                        memberId: m.documentId,
                                        libraryDocumentId:
                                          assignFor[m.documentId],
                                        staffRole:
                                          assignRole[m.documentId] ?? "editor",
                                      }
                                    )
                                )
                              }
                            >
                              Assign
                            </Button>
                          </Flex>
                        )}
                      </Flex>
                    </Box>
                    <Box data-member-slot="actions" style={{ minWidth: 0 }}>
                      <IconButton
                        label={
                          m.status === "invited"
                            ? `Revoke the invite for ${memberLabel(m)}`
                            : `Remove ${memberLabel(m)}`
                        }
                        variant="danger-light"
                        disabled={busy}
                        onClick={() => setRemoving(m)}
                      >
                        <Trash />
                      </IconButton>
                    </Box>
                  </MemberCard>
                ))}
              </Box>
              <Divider />
              <Typography variant="beta" tag="h3">
                Invite
              </Typography>
              <FormGrid>
                <Box style={{ minWidth: 0 }}>
                  <Field.Root name="email" required>
                    <Field.Label>Email</Field.Label>
                    <TextInput
                      type="email"
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEmail(e.target.value)
                      }
                      placeholder="organiser@library.example"
                    />
                  </Field.Root>
                </Box>
                <Box style={{ minWidth: 0 }}>
                  <Field.Root name="teamRole">
                    <Field.Label>Team role</Field.Label>
                    <SingleSelect
                      value={teamRole}
                      onChange={(v) =>
                        setTeamRole(v === "organiser" ? "organiser" : "member")
                      }
                    >
                      <SingleSelectOption value="member">
                        Member
                      </SingleSelectOption>
                      <SingleSelectOption value="organiser">
                        Organiser
                      </SingleSelectOption>
                    </SingleSelect>
                  </Field.Root>
                </Box>
                <Box style={{ minWidth: 0 }}>
                  <Field.Root
                    name="preLibrary"
                    hint="Applied when they accept."
                  >
                    <Field.Label>Pre-assign to (optional)</Field.Label>
                    <SingleSelect
                      value={preLibrary}
                      onChange={(v) => setPreLibrary(String(v))}
                    >
                      <SingleSelectOption value={NONE}>
                        No library
                      </SingleSelectOption>
                      {team.libraries.map((l) => (
                        <SingleSelectOption
                          key={l.documentId}
                          value={l.documentId}
                        >
                          {l.name}
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                    <Field.Hint />
                  </Field.Root>
                </Box>
                {preLibrary !== NONE && (
                  <Box width="9rem">
                    <Field.Root name="preRole">
                      <Field.Label>Level</Field.Label>
                      <SingleSelect
                        value={preRole}
                        onChange={(v) =>
                          setPreRole(v === "owner" ? "owner" : "editor")
                        }
                      >
                        <SingleSelectOption value="editor">
                          Editor
                        </SingleSelectOption>
                        <SingleSelectOption value="owner">
                          Owner
                        </SingleSelectOption>
                      </SingleSelect>
                    </Field.Root>
                  </Box>
                )}
              </FormGrid>
              <Flex justifyContent="flex-end">
                <Button
                  startIcon={<Plus />}
                  loading={busy}
                  disabled={busy || !email.trim() || team.used >= team.seats}
                  onClick={() => void invite()}
                >
                  Send invite
                </Button>
              </Flex>
              {team.used >= team.seats && (
                <Typography variant="pi" textColor="warning600">
                  {team.source === "checkout"
                    ? "Every available seat is taken. Add seats through Stripe billing or remove an unused member or invitation."
                    : "Every seat is taken. Edit the Team to add seats, or remove an unused member or invitation."}
                </Typography>
              )}
            </Flex>
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close>
              <Button variant="tertiary">Close</Button>
            </Modal.Close>
            <Button variant="secondary" startIcon={<Pencil />} onClick={onEdit}>
              Edit team
            </Button>
          </Modal.Footer>
        </PluginModalContent>
      </Modal.Root>
      <Dialog.Root
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <Dialog.Content>
          <Dialog.Header>
            {removing?.status === "invited"
              ? "Revoke this invite?"
              : "Remove this member?"}
          </Dialog.Header>
          <Dialog.Body>
            <Typography>
              {removing?.status === "invited"
                ? `${removing ? memberLabel(removing) : ""} won't be able to join with their link.`
                : `${removing ? memberLabel(removing) : ""} loses their seat, Pro from this team and every staff row this team created. They're emailed for each library.`}
            </Typography>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Keep</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button
                variant="danger-light"
                loading={busy}
                onClick={async () => {
                  const target = removing
                  if (!target) return
                  await run(
                    target.status === "invited"
                      ? "Invite revoked."
                      : "Member removed.",
                    () =>
                      del(
                        `/access/teams/${team.documentId}/members/${target.documentId}`
                      )
                  ).then(() => setRemoving(null))
                }}
              >
                {removing?.status === "invited" ? "Revoke" : "Remove"}
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="sigma" textColor="neutral600" tag="p">
        {label}
      </Typography>
      <Typography variant="omega" tag="p">
        {value}
      </Typography>
    </Box>
  )
}
