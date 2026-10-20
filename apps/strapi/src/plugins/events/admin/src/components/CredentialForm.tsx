import {
  EVENT_PROVIDER_KEYS,
  EVENT_PROVIDERS,
  validateFeedValues,
  type EventProviderKey,
} from "@repo/shared-data"
import {
  Alert,
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  Modal,
  SingleSelect,
  SingleSelectOption,
  Tag,
  TextInput,
  Typography,
} from "@strapi/design-system"
import { useFetchClient } from "@strapi/strapi/admin"
import { useEffect, useId, useRef, useState } from "react"

type Library = { documentId: string; name: string; entityRef?: string }
type Credential = {
  documentId: string
  label: string
  provider: EventProviderKey
  scope: string
  status: "draft" | "pending" | "active" | "paused"
  hints?: Record<string, string>
  libraries?: Library[]
}

function LibrarySearch({
  selected,
  onChange,
  maxOne,
  disabled,
}: {
  selected: Library[]
  onChange: (libraries: Library[]) => void
  maxOne: boolean
  disabled: boolean
}) {
  const { get } = useFetchClient()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Library[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    // Reset the external request state when its identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResults([])
    setError(false)
    if (query.trim().length < 2) {
      setLoading(false)

      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      get<{ data: Library[] }>(
        `/events/admin/libraries?q=${encodeURIComponent(query.trim())}`,
        { signal: controller.signal }
      )
        .then(({ data }) => {
          if (!controller.signal.aborted) setResults(data.data)
        })
        .catch(() => {
          if (!controller.signal.aborted) setError(true)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, get])

  const choices = results.filter(
    (item) =>
      !selected.some((library) => library.documentId === item.documentId)
  )
  const expanded = !disabled && open && query.trim().length >= 2
  const showOptions = expanded && !loading && choices.length > 0
  const choose = (library: Library) => {
    onChange(maxOne ? [library] : [...selected, library])
    setQuery("")
    setOpen(false)
    setActive(0)
  }

  return (
    <Field.Root
      name="libraries"
      hint="Search published libraries by name. Use the arrow keys to choose a result and Enter to select it."
    >
      <Field.Label>{maxOne ? "Library" : "Libraries"}</Field.Label>
      <TextInput
        role="combobox"
        aria-label="Search libraries"
        aria-autocomplete="list"
        aria-expanded={showOptions}
        aria-controls={showOptions ? listId : undefined}
        aria-activedescendant={
          showOptions && choices[active]
            ? `${listId}-${choices[active].documentId}`
            : undefined
        }
        autoComplete="off"
        disabled={disabled}
        placeholder="Type at least two characters…"
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            setOpen(true)
            setActive((current) =>
              choices.length
                ? (current +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    choices.length) %
                  choices.length
                : 0
            )
          } else if (event.key === "Enter" && showOptions && choices[active]) {
            event.preventDefault()
            choose(choices[active])
          }
        }}
      />
      {expanded && (
        <Box
          id={showOptions ? listId : undefined}
          role={showOptions ? "listbox" : undefined}
          aria-label={showOptions ? "Matching libraries" : undefined}
          background="neutral0"
          borderColor="neutral200"
          hasRadius
          padding={2}
          style={{
            maxHeight: 240,
            overflowY: "auto",
            borderWidth: 1,
            borderStyle: "solid",
          }}
        >
          {loading ? (
            <Typography role="status" padding={3}>
              Searching libraries…
            </Typography>
          ) : choices.length ? (
            choices.map((item, index) => (
              <Box
                key={item.documentId}
                id={`${listId}-${item.documentId}`}
                role="option"
                aria-selected={active === index}
                padding={3}
                background={active === index ? "primary100" : "neutral0"}
                hasRadius
                style={{ cursor: "pointer" }}
                onMouseDown={(event: React.MouseEvent) =>
                  event.preventDefault()
                }
                onClick={() => choose(item)}
                onMouseEnter={() => setActive(index)}
              >
                <Typography tag="p" textColor="neutral800">
                  {item.name}
                </Typography>
                {item.entityRef && (
                  <Typography
                    tag="p"
                    variant="pi"
                    textColor="neutral600"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {item.entityRef}
                  </Typography>
                )}
              </Box>
            ))
          ) : (
            <Typography role="status" padding={3}>
              {error
                ? "Search unavailable. Edit the search to retry."
                : "No matching libraries"}
            </Typography>
          )}
        </Box>
      )}
      <Field.Hint />
      {error && (
        <Typography role="status" textColor="danger600">
          Library search is unavailable. Change the search to retry.
        </Typography>
      )}
      <Flex gap={2} wrap="wrap" paddingTop={2}>
        {selected.map((library) => (
          <Tag
            key={library.documentId}
            label={`Remove ${library.name}`}
            disabled={disabled}
            onClick={() =>
              onChange(
                selected.filter(
                  (item) => item.documentId !== library.documentId
                )
              )
            }
            icon={<span aria-hidden>×</span>}
          >
            {library.name}
            <span
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
              }}
            >
              {" "}
              — remove library
            </span>
          </Tag>
        ))}
      </Flex>
    </Field.Root>
  )
}

export function CredentialForm({
  credential,
  onSaved,
  onCancel,
}: {
  credential: Credential | null
  onSaved: () => void
  onCancel: () => void
}) {
  const { post, put } = useFetchClient()
  const [label, setLabel] = useState(credential?.label ?? "")
  const [provider, setProvider] = useState<EventProviderKey>(
    credential?.provider ?? "eventbrite"
  )
  const [scope, setScope] = useState(credential?.scope ?? "library")
  const [status, setStatus] = useState(
    credential?.status === "paused" ? "paused" : "active"
  )
  const [values, setValues] = useState<Record<string, string>>({})
  const [libraries, setLibraries] = useState(credential?.libraries ?? [])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  )
  const alertRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const opener = useRef(document.activeElement as HTMLElement | null)
  const definition = EVENT_PROVIDERS[provider]
  const snapshot = JSON.stringify({
    label,
    provider,
    scope,
    status,
    values,
    libraries,
  })
  const original = useRef(snapshot)
  const busy = saving || testing
  const close = () => {
    if (busy) return
    if (snapshot === original.current) onCancel()
    else setConfirmDiscard(true)
  }
  const save = async () => {
    const invalid: Record<string, string> = {}
    if (!label.trim()) invalid.label = "Enter a label."
    const replacing =
      !credential || Object.values(values).some((value) => value.trim())
    if (replacing) {
      const verdict = validateFeedValues(provider, values)
      if (!verdict.ok) invalid[verdict.field ?? "credentials"] = verdict.error
    }
    setErrors(invalid)
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() =>
        document
          .getElementById(`event-field-${Object.keys(invalid)[0]}`)
          ?.focus()
      )

      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        label: label.trim(),
        provider,
        scope,
        status,
        libraryDocumentIds: libraries.map((library) => library.documentId),
        ...(replacing ? { credentials: values } : {}),
      }
      await (credential
        ? put(`/events/admin/credentials/${credential.documentId}`, payload)
        : post("/events/admin/credentials", payload))
      setValues({})
      onSaved()
    } catch (error) {
      const body = (
        error as { response?: { data?: { error?: string; field?: string } } }
      ).response?.data
      setMessage({
        ok: false,
        text:
          body?.error ??
          "Couldn’t save this credential. Your changes are still here; try again.",
      })
      if (body?.field)
        setErrors({ [body.field]: body.error ?? "Check this value." })
      requestAnimationFrame(() => alertRef.current?.focus())
    } finally {
      setSaving(false)
    }
  }
  const test = async () => {
    if (!credential) return
    setTesting(true)
    setMessage(null)
    try {
      const { data } = await post<{ result?: string; error?: string }>(
        `/events/admin/credentials/${credential.documentId}/test`,
        {}
      )
      setMessage({
        ok: data.result === "ok",
        text:
          data.result === "ok"
            ? "Connection passed using the stored credential."
            : `Connection test: ${data.error ?? data.result ?? "unavailable"}`,
      })
    } catch {
      setMessage({
        ok: false,
        text: "Couldn’t test the stored credential. Try again.",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <Modal.Root
        open
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <Modal.Content
          aria-describedby="credential-description"
          onInteractOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            opener.current?.focus()
          }}
        >
          <Modal.Header closeLabel="Close credential editor">
            <Modal.Title>
              {credential ? "Edit credential" : "Add credential"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Flex direction="column" alignItems="stretch" gap={5}>
              <Typography id="credential-description" textColor="neutral600">
                Connect a library calendar or ticketing account. Stored secrets
                are never loaded into this form.
              </Typography>
              <Field.Root
                name="label"
                id="event-field-label"
                required
                error={errors.label}
              >
                <Field.Label>Label</Field.Label>
                <TextInput
                  disabled={busy}
                  value={label}
                  maxLength={200}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setLabel(event.target.value)
                  }
                  placeholder="British Library — Eventbrite"
                  autoFocus
                />
                <Field.Error />
              </Field.Root>
              <Field.Root name="provider">
                <Field.Label>Provider</Field.Label>
                <SingleSelect
                  value={provider}
                  disabled={!!credential || busy}
                  onChange={(value) => {
                    setProvider(value as EventProviderKey)
                    setValues({})
                    setErrors({})
                    setMessage(null)
                  }}
                >
                  {EVENT_PROVIDER_KEYS.map((key) => (
                    <SingleSelectOption key={key} value={key}>
                      {EVENT_PROVIDERS[key].label}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
              </Field.Root>
              <Field.Root
                name="scope"
                hint={
                  credential
                    ? "A saved feed keeps its original scope."
                    : "Single-library feeds use one library; group feeds match venues across linked libraries."
                }
              >
                <Field.Label>Scope</Field.Label>
                <SingleSelect
                  value={scope}
                  disabled={!!credential || busy}
                  onChange={(value) => {
                    setScope(String(value))
                    if (value === "library")
                      setLibraries((items) => items.slice(0, 1))
                  }}
                >
                  <SingleSelectOption value="library">
                    Single library
                  </SingleSelectOption>
                  <SingleSelectOption value="group">
                    Group of libraries
                  </SingleSelectOption>
                </SingleSelect>
                <Field.Hint />
              </Field.Root>
              <LibrarySearch
                disabled={busy}
                selected={libraries}
                onChange={setLibraries}
                maxOne={scope === "library"}
              />
              <Box padding={4} background="neutral100" hasRadius>
                <Typography tag="h3" variant="delta">
                  {definition.label} credentials
                </Typography>
                {credential && (
                  <Typography tag="p" textColor="neutral600" paddingTop={2}>
                    Leave all fields blank to keep the stored credentials. To
                    replace them, complete every required field.
                  </Typography>
                )}
                <Flex
                  direction="column"
                  alignItems="stretch"
                  gap={4}
                  paddingTop={4}
                >
                  {definition.fields.map((field) => (
                    <Field.Root
                      key={field.key}
                      id={`event-field-${field.key}`}
                      name={field.key}
                      required={!credential && field.required}
                      error={errors[field.key]}
                      hint={field.hint}
                    >
                      <Field.Label>{field.label}</Field.Label>
                      <TextInput
                        disabled={busy}
                        type={field.secret ? "password" : "text"}
                        value={values[field.key] ?? ""}
                        maxLength={field.maxLength}
                        autoComplete={field.secret ? "new-password" : "off"}
                        placeholder={credential?.hints?.[field.key] ?? ""}
                        onChange={(
                          event: React.ChangeEvent<HTMLInputElement>
                        ) =>
                          setValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                      <Field.Hint />
                      <Field.Error />
                    </Field.Root>
                  ))}
                </Flex>
              </Box>
              <Field.Root name="status">
                <Field.Label>Status</Field.Label>
                <SingleSelect
                  value={status}
                  disabled={busy}
                  onChange={(value) => setStatus(String(value))}
                >
                  <SingleSelectOption value="active">
                    Active — include in sync runs
                  </SingleSelectOption>
                  <SingleSelectOption value="paused">Paused</SingleSelectOption>
                </SingleSelect>
              </Field.Root>
              {message && (
                <div ref={alertRef} tabIndex={-1}>
                  <Alert
                    title={message.ok ? "Connection passed" : "Action failed"}
                    variant={message.ok ? "success" : "danger"}
                    closeLabel="Dismiss message"
                    onClose={() => setMessage(null)}
                  >
                    {message.text}
                  </Alert>
                </div>
              )}
            </Flex>
          </Modal.Body>
          <Modal.Footer>
            <Flex gap={2}>
              <Button
                ref={closeButtonRef}
                variant="tertiary"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </Button>
              {credential && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  loading={testing}
                  onClick={() => void test()}
                >
                  Test stored connection
                </Button>
              )}
            </Flex>
            <Button
              loading={saving}
              disabled={busy}
              onClick={() => void save()}
            >
              Save credential
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
      <Dialog.Root open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            closeButtonRef.current?.focus()
          }}
        >
          <Dialog.Header>Discard credential changes?</Dialog.Header>
          <Dialog.Body>
            <Dialog.Description>
              Your unsaved changes will be lost.
            </Dialog.Description>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button
                variant="tertiary"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep editing
              </Button>
            </Dialog.Cancel>
            <Button variant="danger" onClick={onCancel}>
              Discard changes
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
