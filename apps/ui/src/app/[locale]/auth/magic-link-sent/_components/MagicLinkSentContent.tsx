"use client"

// apps/ui/src/app/[locale]/auth/magic-link-sent/_components/MagicLinkSentContent.tsx

import {
  AuthHeading,
  AuthInboxHint,
  AuthNote,
  AuthSwitchPrompt,
} from "@/app/[locale]/auth/_components/AuthFormParts"
import { usePendingEmail } from "@/app/[locale]/auth/_components/pending-email"
import { useAuthFlow } from "@/app/[locale]/auth/_components/useAuthFlow"
import {
  MAGIC_LINK_EMAIL_SUBJECT,
  MAGIC_LINK_TTL_SECONDS,
} from "@/lib/auth-links"

export function MagicLinkSentContent() {
  const { heading, flowRich, tFlow, lifetime } = useAuthFlow()

  const email = usePendingEmail()

  return (
    <>
      <AuthHeading
        layout="utility"
        icon="mdi:email-fast-outline"
        title={heading("inbox")}
        subtitle={
          email ? flowRich("signinSent", email) : tFlow("signinSentUnknown")
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <AuthInboxHint
          subject={MAGIC_LINK_EMAIL_SUBJECT}
          detail={tFlow("linkOnce", {
            duration: lifetime(MAGIC_LINK_TTL_SECONDS),
          })}
        />
        <AuthNote>{tFlow("closeTab")}</AuthNote>
      </div>

      <AuthSwitchPrompt
        prompt={tFlow("notReceived")}
        linkLabel={tFlow("sendAnother")}
        href="/auth/signin"
      />
    </>
  )
}
