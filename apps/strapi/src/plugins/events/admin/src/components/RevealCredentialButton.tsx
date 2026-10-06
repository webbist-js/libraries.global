// apps/strapi/src/plugins/events/admin/src/components/RevealCredentialButton.tsx
import { Box, Button, Dialog, Typography } from "@strapi/design-system"
import { useFetchClient, useRBAC } from "@strapi/strapi/admin"
import { useState } from "react"

const PERMISSIONS = [
  { action: "plugin::events.reveal-credentials", subject: null },
]

/**
 * Reveals one stored value for an admin with "Reveal event credentials".
 * The values live in component state only while the dialog is open, and
 * every reveal is logged server-side.
 */
export function RevealCredentialButton({
  documentId,
  slot,
}: {
  documentId: string
  slot: "current" | "pending"
}) {
  const { allowedActions } = useRBAC(PERMISSIONS)
  const { post } = useFetchClient()
  const [values, setValues] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!allowedActions.canRevealCredentials) return null

  const reveal = async () => {
    setError(null)
    try {
      const { data } = await post(
        `/events/admin/credentials/${documentId}/reveal`,
        { slot }
      )
      setValues((data as any).data)
    } catch {
      setError("Couldn't reveal the value.")
    }
  }

  return (
    <Dialog.Root
      onOpenChange={(open: boolean) => {
        if (!open) setValues(null)
      }}
    >
      <Dialog.Trigger>
        <Button variant="tertiary" size="S" onClick={reveal}>
          {slot === "current" ? "Reveal value" : "Reveal new value"}
        </Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>Credential value</Dialog.Header>
        <Dialog.Body>
          <Box>
            {error ? (
              <Typography textColor="danger600">{error}</Typography>
            ) : null}
            {values
              ? Object.entries(values).map(([k, v]) => (
                  <Box key={k} paddingBottom={2}>
                    <Typography variant="sigma">{k}</Typography>
                    <Typography
                      tag="p"
                      style={{
                        wordBreak: "break-all",
                        fontFamily: "monospace",
                      }}
                    >
                      {v}
                    </Typography>
                  </Box>
                ))
              : !error && <Typography>Loading…</Typography>}
            <Typography variant="pi" textColor="neutral600">
              This reveal was logged with your name.
            </Typography>
          </Box>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Cancel>
            <Button variant="tertiary">Close</Button>
          </Dialog.Cancel>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  )
}
