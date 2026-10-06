import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

/** Shown instead of the dashboard when the signed-in user has no claimed library. */
export function ClaimFirst() {
  return (
    <section
      aria-labelledby="claim-first-heading"
      className="px-6 py-10 sm:px-10"
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "20px",
        background: T.bg.deep,
      }}
    >
      <p
        className="inline-flex items-center gap-2"
        style={{
          fontFamily: T.font.sans,
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--tint-special-fg)",
          background: "var(--tint-special-bg)",
          borderRadius: "999px",
          padding: "6px 12px",
          margin: "0 0 20px",
        }}
      >
        <Icon
          icon="mdi:shield-account-outline"
          className="size-4"
          aria-hidden="true"
        />
        Verified librarian required
      </p>
      <h2
        id="claim-first-heading"
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(26px, 3vw, 32px)",
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          color: T.ink.base,
          margin: "0 0 12px",
        }}
      >
        Claim your library first.
      </h2>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "16px",
          lineHeight: 1.6,
          color: T.ink.dim,
          maxWidth: "52ch",
          margin: "0 0 28px",
        }}
      >
        To connect an event feed you must be a verified librarian affiliated
        with that library. Claim your library first to get verified.
      </p>
      <GlobalLink
        href="/contribute/index"
        className="inline-flex items-center gap-2 rounded-full bg-(--t-accent-primary) px-6 py-3 font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
        style={{ fontFamily: T.font.sans, fontSize: "15px" }}
      >
        Find your library, then choose Claim
        <Icon icon="mdi:arrow-right" className="size-4" aria-hidden="true" />
      </GlobalLink>
    </section>
  )
}
