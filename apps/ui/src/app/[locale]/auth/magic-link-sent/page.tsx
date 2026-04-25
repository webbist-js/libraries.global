import type { Locale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

export default async function MagicLinkSentPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await getTranslations("Auth")

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-6 py-16"
      style={{ background: T.bg.space }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-10"
        style={{
          background: T.bg.deep,
          border: `1px solid ${T.border.hi}`,
        }}
      >
        {/* Success icon */}
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: "rgba(142,240,179,.10)",
            border: `1px solid rgba(142,240,179,.25)`,
            fontSize: "24px",
          }}
          aria-hidden="true"
        >
          ✉
        </div>

        {/* Heading */}
        <h1
          className="mb-3 text-3xl"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 400,
            color: T.ink.base,
            lineHeight: 1.2,
          }}
        >
          Check your inbox
        </h1>

        {/* Body */}
        <p
          className="mb-2 text-base leading-relaxed"
          style={{ fontFamily: T.font.sans, color: T.ink.dim }}
        >
          We sent a sign-in link to your email address. Click the link in the
          email to complete your sign in.
        </p>

        <p
          className="mb-8 text-sm"
          style={{ fontFamily: T.font.sans, color: T.ink.low }}
        >
          The link expires in 10 minutes. You can safely close this tab while
          you wait.
        </p>

        {/* Divider */}
        <div
          className="mb-6 h-px w-full"
          style={{ background: T.border.line }}
        />

        {/* Back to sign in */}
        <GlobalLink
          href="/auth/signin"
          className="text-sm transition-colors"
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.accent.aurora,
            textDecoration: "none",
          }}
        >
          ← Back to sign in
        </GlobalLink>
      </div>
    </div>
  )
}
