"use client"

// apps/ui/src/app/[locale]/auth/magic-link-sent/_components/MagicLinkSentContent.tsx

import {
  AuthHeading,
  AuthInboxHint,
  AuthNote,
  AuthSwitchPrompt,
} from "@/app/[locale]/auth/_components/AuthFormParts"
import { usePendingEmail } from "@/app/[locale]/auth/_components/pending-email"
import {
  linkLifetime,
  MAGIC_LINK_EMAIL_SUBJECT,
  MAGIC_LINK_TTL_SECONDS,
} from "@/lib/auth-links"
import { T } from "@/lib/design-tokens"

const LIFETIME = linkLifetime(MAGIC_LINK_TTL_SECONDS)

export function MagicLinkSentContent() {
  const email = usePendingEmail()

  return (
    <>
      <AuthHeading
        icon="mdi:email-fast-outline"
        title="Check your"
        italic="inbox."
        subtitle={
          email ? (
            <>
              We sent a sign-in link to{" "}
              <strong style={{ color: T.ink.base }}>{email}</strong>.
            </>
          ) : (
            "We sent a sign-in link to your email address."
          )
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <AuthInboxHint
          subject={MAGIC_LINK_EMAIL_SUBJECT}
          detail={`The link works once, within ${LIFETIME}.`}
        />
        <AuthNote>
          You can close this tab: the link signs you in wherever you open it.
          Nothing yet? Check your spam or promotions folder.
        </AuthNote>
      </div>

      <AuthSwitchPrompt
        prompt={"Didn\u2019t get it?"}
        linkLabel="Send another link"
        href="/auth/signin"
      />
    </>
  )
}
