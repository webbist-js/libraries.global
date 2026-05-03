import { useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

import { CredentialForm } from "./CredentialForm"

type Library = {
  documentId: string
  name: string
  entityRef?: string
}

type Credential = {
  documentId: string
  label: string
  provider: string
  scope: string
  isActive: boolean
  libraries?: Library[]
  lastSyncAt?: string
  lastSyncEventCount?: number
  lastSyncError?: string
}

const PROVIDER_COLORS: Record<string, string> = {
  eventbrite: "#ff6060",
  ical: "#1b7c3a",
  custom_ical: "#1b7c3a",
  meetup: "#e8174b",
  google_events: "#4285f4",
  facebook_events: "#1877f2",
  librarycloud: "#0c75af",
}

function ProviderBadge({ provider }: { provider: string }) {
  const color = PROVIDER_COLORS[provider] ?? "#8e8ea9"

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: 700,
        background: color + "18",
        color,
        border: `1px solid ${color}40`,
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
      }}
    >
      {provider.replaceAll("_", " ")}
    </span>
  )
}

function formatDate(iso?: string) {
  if (!iso) return null

  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function CredentialCard({
  cred,
  onEdit,
  onDeleted,
}: {
  cred: Credential
  onEdit: (cred: Credential) => void
  onDeleted: () => void
}) {
  const { del, post } = useFetchClient()
  const [testResult, setTestResult] = useState<{
    ok: boolean
    message?: string
    error?: string
  } | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const hasError = !!cred.lastSyncError

  const handleTest = async () => {
    setTestLoading(true)
    setTestResult(null)
    try {
      const { data } = await post(
        `/events/admin/credentials/${cred.documentId}/test`,
        {}
      )
      setTestResult(data as { ok: boolean; message?: string; error?: string })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Test failed"
      setTestResult({ ok: false, error: message })
    } finally {
      setTestLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete credential "${cred.label}"? This cannot be undone.`))
      return
    setDeleteLoading(true)
    try {
      await del(`/events/admin/credentials/${cred.documentId}`)
      onDeleted()
    } catch {
      alert("Delete failed — check server logs.")
    } finally {
      setDeleteLoading(false)
    }
  }

  const libraryNames =
    cred.libraries && cred.libraries.length > 0
      ? cred.libraries.length === 1
        ? cred.libraries[0]!.name
        : `${cred.libraries.length} libraries linked`
      : "No libraries linked"

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dcdce4",
        borderLeft: `4px solid ${hasError ? "#d02b20" : "#1b7c3a"}`,
        borderRadius: "8px",
        padding: "16px 18px",
        boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {/* Header */}
      <div>
        <p
          style={{
            margin: "0 0 4px",
            fontSize: "14px",
            fontWeight: 700,
            color: "#32324d",
          }}
        >
          {cred.label}
        </p>
        <div
          style={{
            display: "flex",
            gap: "6px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <ProviderBadge provider={cred.provider} />
          <span
            style={{
              fontSize: "11px",
              color: "#8e8ea9",
              textTransform: "uppercase" as const,
              letterSpacing: "0.06em",
            }}
          >
            {cred.scope}
          </span>
          {!cred.isActive && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#666687",
                background: "#f0f0ff",
                border: "1px solid #dcdce4",
                borderRadius: "4px",
                padding: "1px 6px",
                textTransform: "uppercase" as const,
              }}
            >
              Inactive
            </span>
          )}
        </div>
      </div>

      {/* Libraries */}
      <p style={{ margin: 0, fontSize: "12px", color: "#666687" }}>
        {libraryNames}
      </p>

      {/* Last sync info */}
      {cred.lastSyncAt && (
        <p style={{ margin: 0, fontSize: "11px", color: "#8e8ea9" }}>
          Last sync: {formatDate(cred.lastSyncAt)}
          {cred.lastSyncEventCount !== undefined &&
            ` · ${cred.lastSyncEventCount} events`}
        </p>
      )}
      {cred.lastSyncError && (
        <p
          style={{
            margin: 0,
            fontSize: "11px",
            color: "#d02b20",
            wordBreak: "break-word",
          }}
        >
          {cred.lastSyncError}
        </p>
      )}

      {/* Test result */}
      {testResult && (
        <p
          style={{
            margin: 0,
            fontSize: "11px",
            color: testResult.ok ? "#1b7c3a" : "#d02b20",
          }}
        >
          {testResult.ok
            ? `✓ ${testResult.message ?? "Connection OK"}`
            : `✗ ${testResult.error ?? "Test failed"}`}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
        <button
          onClick={() => onEdit(cred)}
          style={{
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 600,
            background: "#f0f0ff",
            color: "#4945ff",
            border: "1px solid #c4c4ff",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Edit
        </button>
        <button
          onClick={() => void handleTest()}
          disabled={testLoading}
          style={{
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 600,
            background: "#fff",
            color: "#666687",
            border: "1px solid #dcdce4",
            borderRadius: "5px",
            cursor: testLoading ? "not-allowed" : "pointer",
            opacity: testLoading ? 0.5 : 1,
          }}
        >
          {testLoading ? "Testing…" : "Test"}
        </button>
        <button
          onClick={() => void handleDelete()}
          disabled={deleteLoading}
          style={{
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 600,
            background: "#ffeaea",
            color: "#d02b20",
            border: "1px solid #f5c0be",
            borderRadius: "5px",
            cursor: deleteLoading ? "not-allowed" : "pointer",
            opacity: deleteLoading ? 0.5 : 1,
            marginLeft: "auto",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export function CredentialList() {
  const { get } = useFetchClient()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Credential | null>(null)

  const loadCredentials = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await get("/events/admin/credentials")
      const items = Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray(data)
          ? data
          : []
      setCredentials(items as Credential[])
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load credentials."
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => {
    void loadCredentials()
  }, [loadCredentials])

  const openCreate = () => {
    setEditTarget(null)
    setFormOpen(true)
  }

  const openEdit = (cred: Credential) => {
    setEditTarget(cred)
    setFormOpen(true)
  }

  const handleSaved = () => {
    setFormOpen(false)
    setEditTarget(null)
    void loadCredentials()
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: "#32324d",
          }}
        >
          Event Source Credentials
        </p>
        <button
          onClick={openCreate}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            background: "#4945ff",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          + Add Credential
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#ffeaea",
            border: "1px solid #f5c0be",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#d02b20",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <p style={{ color: "#8e8ea9", fontSize: "13px" }}>Loading…</p>
      )}

      {!loading && credentials.length === 0 && !error && (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#fff",
            border: "1px dashed #dcdce4",
            borderRadius: "8px",
            cursor: "pointer",
          }}
          onClick={openCreate}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>+</div>
          <p style={{ fontSize: "13px", color: "#666687", margin: 0 }}>
            No credentials yet — click to add one
          </p>
        </div>
      )}

      {!loading && credentials.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {credentials.map((cred) => (
            <CredentialCard
              key={cred.documentId}
              cred={cred}
              onEdit={openEdit}
              onDeleted={() => void loadCredentials()}
            />
          ))}

          {/* Add card */}
          <div
            onClick={openCreate}
            style={{
              background: "#fff",
              border: "1px dashed #dcdce4",
              borderRadius: "8px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
              minHeight: "120px",
              color: "#8e8ea9",
              fontSize: "13px",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.borderColor = "#4945ff"
              el.style.color = "#4945ff"
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.borderColor = "#dcdce4"
              el.style.color = "#8e8ea9"
            }}
          >
            <span style={{ fontSize: "24px" }}>+</span>
            Add Credential
          </div>
        </div>
      )}

      {/* Modal */}
      {formOpen && (
        <CredentialForm
          credential={editTarget}
          onSaved={handleSaved}
          onCancel={() => {
            setFormOpen(false)
            setEditTarget(null)
          }}
        />
      )}
    </div>
  )
}
