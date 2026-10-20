import {
  EVENT_PROVIDERS,
  FEED_TEST_LABEL,
  type EventProviderKey,
  type FeedTestCode,
} from "@repo/shared-data"
import {
  Alert,
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Loader,
  Typography,
} from "@strapi/design-system"
import { useFetchClient, useRBAC } from "@strapi/strapi/admin"
import { useEffect, useState } from "react"

import { CredentialForm } from "./CredentialForm"
import { RevealCredentialButton } from "./RevealCredentialButton"

type Library = {
  documentId: string
  name: string
  entityRef?: string
}

type Credential = {
  documentId: string
  label: string
  provider: EventProviderKey
  scope: string
  status: "draft" | "pending" | "active" | "paused"
  pausedReason?: "library" | "admin" | "sync_failures" | null
  source: "admin" | "library"
  hints?: Record<string, string>
  pendingHints?: Record<string, string> | null
  pendingSubmissionDocumentId?: string | null
  lastTestedAt?: string | null
  lastTestResult?: FeedTestCode | null
  libraries?: Library[]
  lastSyncAt?: string
  lastSyncEventCount?: number
  lastErrorMessage?: string
}

function statusLabel(cred: Credential): string {
  if (cred.status === "active") return "Active"
  if (cred.status === "paused")
    return `Paused (${cred.pausedReason ?? "admin"})`
  if (cred.status === "pending") return "Waiting for review"

  return "Draft"
}

const PERMISSIONS = [
  { action: "plugin::events.manage-credentials", subject: null },
]
const date = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "Not yet"
function CredentialCard({
  cred,
  canManage,
  onEdit,
  onChanged,
}: {
  cred: Credential
  canManage: boolean
  onEdit: () => void
  onChanged: () => void
}) {
  const { post, del } = useFetchClient()
  const [testing, setTesting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  )
  const test = async () => {
    setTesting(true)
    setMessage(null)
    try {
      const { data } = await post<{ result?: FeedTestCode }>(
        `/events/admin/credentials/${cred.documentId}/test`,
        {}
      )
      setMessage({
        ok: data.result === "ok",
        text: data.result
          ? FEED_TEST_LABEL[data.result]
          : "Test unavailable. Try again.",
      })
    } catch {
      setMessage({
        ok: false,
        text: "Couldn’t test this connection. Try again.",
      })
    } finally {
      setTesting(false)
    }
  }
  const remove = async () => {
    setDeleting(true)
    setMessage(null)
    try {
      await del(`/events/admin/credentials/${cred.documentId}`)
      setConfirmDelete(false)
      onChanged()
    } catch {
      setMessage({
        ok: false,
        text: "Couldn’t delete this credential. Try again.",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box
      background="neutral0"
      padding={6}
      hasRadius
      shadow="tableShadow"
      style={{ minWidth: 0 }}
    >
      <Flex direction="column" alignItems="stretch" gap={4}>
        <Typography tag="h3" variant="delta">
          {cred.label}
        </Typography>
        <Flex gap={2} wrap="wrap">
          <Badge>
            {EVENT_PROVIDERS[cred.provider]?.label ?? cred.provider}
          </Badge>
          <Badge>{statusLabel(cred)}</Badge>
          <Badge>
            {cred.source === "library"
              ? "Library connected"
              : "Admin connected"}
          </Badge>
          {cred.pendingSubmissionDocumentId && (
            <Badge>Replacement in review</Badge>
          )}
        </Flex>
        <Typography textColor="neutral600">
          {cred.libraries?.length
            ? cred.libraries.map((library) => library.name).join(", ")
            : "No libraries linked"}{" "}
          · {cred.scope === "group" ? "Group feed" : "Single-library feed"}
        </Typography>
        <Box background="neutral100" padding={4} hasRadius>
          <Typography tag="p" textColor="neutral600">
            Last test:{" "}
            {cred.lastTestResult
              ? FEED_TEST_LABEL[cred.lastTestResult]
              : "Not tested"}{" "}
            · {date(cred.lastTestedAt)}
          </Typography>
          <Typography tag="p" textColor="neutral600" paddingTop={2}>
            Last sync: {date(cred.lastSyncAt)}
            {cred.lastSyncEventCount !== undefined
              ? ` · ${cred.lastSyncEventCount} events`
              : ""}
          </Typography>
        </Box>
        {cred.lastErrorMessage && (
          <Typography
            tag="p"
            textColor="danger600"
            style={{ overflowWrap: "anywhere" }}
          >
            {cred.lastErrorMessage}
          </Typography>
        )}
        {message && (
          <Typography
            tag="p"
            role={message.ok ? "status" : "alert"}
            textColor={message.ok ? "success600" : "danger600"}
          >
            {message.text}
          </Typography>
        )}
        <Flex gap={2} wrap="wrap">
          {canManage && (
            <>
              <Button variant="secondary" size="S" onClick={onEdit}>
                Edit
              </Button>
              <Button
                variant="tertiary"
                size="S"
                loading={testing}
                disabled={testing || deleting}
                onClick={() => void test()}
              >
                Test connection
              </Button>
            </>
          )}
          <RevealCredentialButton documentId={cred.documentId} slot="current" />
          {cred.pendingHints && (
            <RevealCredentialButton
              documentId={cred.documentId}
              slot="pending"
            />
          )}
          {canManage && (
            <Button
              variant="danger-light"
              size="S"
              disabled={testing || deleting}
              onClick={() => {
                setMessage(null)
                setConfirmDelete(true)
              }}
            >
              Delete
            </Button>
          )}
        </Flex>
      </Flex>
      <Dialog.Root
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!deleting) setConfirmDelete(open)
        }}
      >
        <Dialog.Content>
          <Dialog.Header>Delete credential</Dialog.Header>
          <Dialog.Body>
            <Box>
              <Dialog.Description>
                Delete “{cred.label}”? Its stored credentials will be removed
                and this feed will stop syncing.
              </Dialog.Description>
              {message && !message.ok && (
                <Typography
                  tag="p"
                  role="alert"
                  textColor="danger600"
                  paddingTop={3}
                >
                  {message.text}
                </Typography>
              )}
            </Box>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button
                variant="tertiary"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </Dialog.Cancel>
            <Button
              variant="danger"
              disabled={deleting}
              loading={deleting}
              onClick={() => void remove()}
            >
              Delete credential
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}

export function CredentialList() {
  const { get } = useFetchClient()
  const { allowedActions } = useRBAC(PERMISSIONS)
  const canManage = !!allowedActions.canManageCredentials
  const [rows, setRows] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Credential | null | undefined>()
  useEffect(() => {
    const controller = new AbortController()
    // Reset the external request state when its identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(false)
    get("/events/admin/credentials", { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data)) throw new Error("Invalid credential response")
        if (!controller.signal.aborted) setRows(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [get, revision])
  const refresh = () => setRevision((value) => value + 1)

  return (
    <Flex direction="column" alignItems="stretch" gap={5}>
      <Flex justifyContent="space-between" gap={3} wrap="wrap">
        <Box>
          <Typography tag="h2" variant="delta">
            Source credentials
          </Typography>
          <Typography tag="p" textColor="neutral600" paddingTop={2}>
            Connect feeds, check their health and manage stored credentials.
          </Typography>
        </Box>
        <Flex gap={2}>
          <Button variant="tertiary" disabled={loading} onClick={refresh}>
            Refresh
          </Button>
          {canManage && (
            <Button onClick={() => setEditing(null)}>Add credential</Button>
          )}
        </Flex>
      </Flex>
      {error && (
        <Alert
          variant="danger"
          title="Couldn’t load credentials"
          closeLabel="Retry"
          onClose={refresh}
        >
          Your feeds could not be loaded.{" "}
          <Button variant="tertiary" onClick={refresh}>
            Try again
          </Button>
        </Alert>
      )}
      {loading ? (
        <Loader>Loading credentials</Loader>
      ) : rows.length === 0 && !error ? (
        <Box padding={8} background="neutral0" hasRadius>
          <Typography tag="h3" variant="delta">
            Connect your first event source
          </Typography>
          <Typography tag="p" textColor="neutral600" paddingTop={3}>
            Library calendars and ticketing feeds keep the programme up to date.
          </Typography>
          {canManage && (
            <Box paddingTop={5}>
              <Button onClick={() => setEditing(null)}>Add credential</Button>
            </Box>
          )}
        </Box>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 32rem), 1fr))",
            gap: "2rem",
          }}
        >
          {rows.map((cred) => (
            <CredentialCard
              key={cred.documentId}
              cred={cred}
              canManage={canManage}
              onEdit={() => setEditing(cred)}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
      {editing !== undefined && (
        <CredentialForm
          credential={editing}
          onSaved={() => {
            setEditing(undefined)
            refresh()
          }}
          onCancel={() => setEditing(undefined)}
        />
      )}
    </Flex>
  )
}
