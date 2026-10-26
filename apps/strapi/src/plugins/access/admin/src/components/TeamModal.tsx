import {
  Box,
  Button,
  Checkbox,
  Combobox,
  ComboboxOption,
  DatePicker,
  Field,
  Flex,
  Modal,
  NumberInput,
  Tag,
  Textarea,
  TextInput,
  Typography,
} from "@strapi/design-system"
import { Cross } from "@strapi/icons"
import { useFetchClient, useNotification } from "@strapi/strapi/admin"
import { useEffect, useState } from "react"

import { apiError, type Team, type TeamLibrary } from "./teamsMeta"
import {
  PluginModalContent,
  FormGrid,
} from "../../../../../admin/components/PluginUI"

/**
 * Create or edit a Team: name, seats, the libraries it covers (search by
 * name), verified, expiry and notes. Verifying is the act of trust: it
 * lets the organiser create staff access without a Moderator.
 */
export function TeamModal({
  team,
  onClose,
  onSaved,
}: {
  team: Team | null
  onClose: () => void
  onSaved: (team: Team) => void
}) {
  const { get, post, put } = useFetchClient()
  const { toggleNotification } = useNotification()
  const [name, setName] = useState(team?.name ?? "")
  const [seats, setSeats] = useState<number>(team?.seats ?? 5)
  const [libraries, setLibraries] = useState<TeamLibrary[]>(
    team?.libraries ?? []
  )
  const [widgetBranding, setWidgetBranding] = useState(
    team?.widgetBranding === true
  )
  const [verified, setVerified] = useState(!!team?.verifiedAt)
  const [lapsed, setLapsed] = useState(
    team?.source === "checkout"
      ? team.billingSuspended === true
      : team?.status === "lapsed"
  )
  const [publicServiceApproved, setPublicServiceApproved] = useState(
    team?.publicServiceApproved === true
  )
  const [expires, setExpires] = useState<Date | undefined>(
    team?.expiresAt ? new Date(team.expiresAt) : undefined
  )
  const [notes, setNotes] = useState(team?.notes ?? "")
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<TeamLibrary[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setOptions([])

      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await get(
          `/access/libraries?q=${encodeURIComponent(q)}`
        )
        if (!cancelled)
          setOptions((data as { data?: TeamLibrary[] })?.data ?? [])
      } catch {
        if (!cancelled) setOptions([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, get])

  const addLibrary = (documentId: string) => {
    const found = options.find((o) => o.documentId === documentId)
    if (!found || libraries.some((l) => l.documentId === documentId)) return
    setLibraries([...libraries, found])
    setQuery("")
  }

  async function save() {
    setBusy(true)
    setError(null)
    const body = {
      name: name.trim(),
      ...(team?.source === "checkout"
        ? {}
        : { seats, expiresAt: expires ? expires.toISOString() : null }),
      libraryDocumentIds: libraries.map((l) => l.documentId),
      publicServiceApproved,
      notes: notes.trim() || null,
      ...(team ? { status: lapsed ? "lapsed" : "active" } : { verified }),
    }
    try {
      let saved: Team
      if (team) {
        const { data } = await put(`/access/teams/${team.documentId}`, body)
        saved = (data as { data: Team }).data
        if (!!team.verifiedAt !== verified) {
          const res = await post(`/access/teams/${team.documentId}/verify`, {
            verified,
          })
          saved = (res.data as { data: Team }).data
        }
      } else {
        const { data } = await post("/access/teams", body)
        saved = (data as { data: Team }).data
      }
      if (saved.widgetBranding !== widgetBranding) {
        const res = await post(
          `/access/teams/${saved.documentId}/widget-branding`,
          { enabled: widgetBranding }
        )
        saved = (res.data as { data: Team }).data
      }
      toggleNotification({
        type: "success",
        message: team ? "Team saved." : "Team created.",
      })
      onSaved(saved)
    } catch (err) {
      setError(apiError(err, "The team couldn't be saved."))
    } finally {
      setBusy(false)
    }
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <PluginModalContent>
        <Modal.Header>
          <Modal.Title>{team ? `Edit ${team.name}` : "New team"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root name="name" required>
              <Field.Label>Name</Field.Label>
              <TextInput
                value={name}
                maxLength={120}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setName(e.target.value)
                }
                placeholder="e.g. Devon Libraries"
              />
            </Field.Root>
            <FormGrid>
              <Box style={{ flex: "1 1 240px", minWidth: 0 }}>
                <Field.Root
                  name="seats"
                  required
                  hint="Active and invited members together."
                >
                  <Field.Label>Seats</Field.Label>
                  <NumberInput
                    disabled={team?.source === "checkout"}
                    value={seats}
                    onValueChange={(v?: number) => setSeats(v ?? 1)}
                    step={1}
                  />
                  <Field.Hint />
                </Field.Root>
              </Box>
              <Box style={{ flex: "1 1 240px", minWidth: 0 }}>
                <Field.Root name="expiresAt" hint="Leave empty for no end.">
                  <Field.Label>Expires (optional)</Field.Label>
                  <DatePicker
                    disabled={team?.source === "checkout"}
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
              name="libraries"
              hint="The libraries the organiser may assign staff to. Removing one ends every Team-created staff row at it."
            >
              <Field.Label>Libraries</Field.Label>
              <Combobox
                value=""
                autocomplete="none"
                onInputChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setQuery(e.target.value)
                }
                onChange={(v?: string) => v && addLibrary(v)}
                loading={searching}
                placeholder="Search libraries by name"
                noOptionsMessage={() =>
                  query.trim().length < 2
                    ? "Type at least two characters"
                    : "No library matches"
                }
              >
                {options.map((o) => (
                  <ComboboxOption key={o.documentId} value={o.documentId}>
                    {o.name} · {o.libraryType}
                  </ComboboxOption>
                ))}
              </Combobox>
              <Field.Hint />
            </Field.Root>
            {libraries.length > 0 && (
              <Flex gap={2} wrap="wrap">
                {libraries.map((l) => (
                  <Tag
                    key={l.documentId}
                    icon={<Cross aria-hidden />}
                    label={`Remove ${l.name}`}
                    onClick={() =>
                      setLibraries(
                        libraries.filter((x) => x.documentId !== l.documentId)
                      )
                    }
                  >
                    {l.name}
                  </Tag>
                ))}
              </Flex>
            )}
            <Flex gap={6} wrap="wrap">
              <Checkbox
                checked={verified}
                onCheckedChange={(v: boolean | "indeterminate") =>
                  setVerified(v === true)
                }
              >
                Verified: the organiser’s assignments create staff access at
                once
              </Checkbox>
              {team && (
                <Checkbox
                  checked={lapsed}
                  onCheckedChange={(v: boolean | "indeterminate") =>
                    setLapsed(v === true)
                  }
                >
                  {team.source === "checkout"
                    ? "Suspend Team access independently of billing"
                    : "Lapsed: members keep their rows but lose Pro and Team"}
                </Checkbox>
              )}
            </Flex>
            <Checkbox
              checked={publicServiceApproved}
              onCheckedChange={(v: boolean | "indeterminate") =>
                setPublicServiceApproved(v === true)
              }
            >
              Public-library-service discount eligibility confirmed (new
              subscriptions only)
            </Checkbox>
            <Checkbox
              checked={widgetBranding}
              onCheckedChange={(v: boolean | "indeterminate") =>
                setWidgetBranding(v === true)
              }
            >
              Widget branding entitlement granted (source credits remain
              mandatory)
            </Checkbox>
            <Field.Root
              name="notes"
              hint="Admin only; never shown to the team."
            >
              <Field.Label>Notes</Field.Label>
              <Textarea
                value={notes}
                maxLength={2000}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setNotes(e.target.value)
                }
                placeholder="How the service was verified, who asked, the invoice reference."
              />
              <Field.Hint />
            </Field.Root>
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
            onClick={() => void save()}
            loading={busy}
            disabled={!name.trim()}
          >
            {team ? "Save" : "Create team"}
          </Button>
        </Modal.Footer>
      </PluginModalContent>
    </Modal.Root>
  )
}
