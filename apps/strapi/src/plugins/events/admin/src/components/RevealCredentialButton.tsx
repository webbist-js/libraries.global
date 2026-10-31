// apps/strapi/src/plugins/events/admin/src/components/RevealCredentialButton.tsx
import { Box, Button, Dialog, Typography } from "@strapi/design-system"
import { useFetchClient, useRBAC } from "@strapi/strapi/admin"
import { useEffect, useState } from "react"

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
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open || !allowedActions.canRevealCredentials) return
    const controller = new AbortController()
    let current = true
    // Reset the external request state when its identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(null)
    setError(null)
    post(
      `/events/admin/credentials/${documentId}/reveal`,
      { slot },
      { signal: controller.signal }
    )
      .then(({ data }) => {
        if (current) setValues((data as { data: Record<string, string> }).data)
      })
      .catch((error: unknown) => {
        const reason = error as { response?: { data?: { error?: string } } }
        if (current)
          setError(
            reason.response?.data?.error === "reauthentication_required"
              ? "Sign out and sign back in to reveal credentials, then try again within five minutes."
              : "Couldn’t reveal the value."
          )
      })

    return () => {
      current = false
      controller.abort()
    }
  }, [open, allowedActions.canRevealCredentials, documentId, slot, post])
  if (!allowedActions.canRevealCredentials) return null

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(open: boolean) => {
        setValues(null)
        setError(null)
        setOpen(open)
      }}
    >
      <Dialog.Trigger>
        <Button variant="tertiary" size="S">
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
            <Dialog.Description variant="pi" textColor="neutral600">
              Reveals are logged with your admin identity.
            </Dialog.Description>
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
