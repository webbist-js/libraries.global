type Library = { documentId: string; name: string; entityRef?: string }
type Credential = {
  documentId: string
  label: string
  provider: string
  scope: string
  isActive: boolean
  libraries?: Library[]
}

export function CredentialForm({
  credential: _credential,
  onSaved: _onSaved,
  onCancel,
}: {
  credential: Credential | null
  onSaved: () => void
  onCancel: () => void
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(33,33,52,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "24px",
          width: "520px",
        }}
      >
        <p>Credential form — coming soon</p>
        <button onClick={onCancel}>Close</button>
      </div>
    </div>
  )
}
