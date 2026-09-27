// apps/ui/src/app/[locale]/auth/_components/AuthShell.tsx
//
// Split layout for the auth forms: an editorial panel on the left (lg and up)
// and a white form card on the right with a top bar and a footnote strip.

import { Icon } from "@iconify/react"
import type { Locale } from "next-intl"
import type { ReactNode } from "react"

import LocaleSwitcher from "@/components/elementary/LocaleSwitcher"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

const LEGAL_LINKS = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Help", href: "/docs" },
]

export function AuthShell({
  locale,
  aside,
  footnote,
  children,
}: {
  locale: Locale
  aside: ReactNode
  /** Reassurance line in the footer strip, e.g. "We never share your email." */
  footnote: string
  children: ReactNode
}) {
  return (
    <div
      className="flex min-h-dvh w-full gap-4 p-3 sm:p-4"
      style={{ background: T.bg.void }}
    >
      <span data-hide-footer="true" hidden />

      {aside}

      <div
        className="flex min-w-0 flex-1 flex-col px-5 py-5 sm:px-10 sm:py-7"
        style={{
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
          borderRadius: "24px",
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <GlobalLink
            href="/"
            className="-ml-2 flex items-center gap-1.5 rounded-full py-1.5 pr-3 pl-1.5 transition-colors hover:bg-(--t-bg-muted-2)"
            style={{
              fontFamily: T.font.sans,
              fontSize: "15px",
              fontWeight: 600,
              color: T.ink.base,
              borderRadius: "999px",
            }}
          >
            <Icon icon="mdi:chevron-left" width={20} aria-hidden="true" />
            Back to the atlas
          </GlobalLink>
          <LocaleSwitcher
            locale={locale}
            triggerClassName="h-10 w-auto gap-1 rounded-full border-(--t-border-line) bg-(--t-bg-deep) px-4 text-[15px] font-semibold uppercase text-(--t-ink-base) shadow-none hover:border-(--t-border-hi) [&_svg]:text-(--t-ink-base) [&_svg]:opacity-100"
          />
        </div>

        <div className="flex flex-1 items-center justify-center py-10 sm:py-14">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>

        <div
          className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderTop: `1px solid ${T.border.line}`,
            fontFamily: T.font.sans,
            fontSize: "14px",
            color: T.ink.dim,
          }}
        >
          <p className="flex items-center gap-2">
            <Icon
              icon="mdi:check"
              width={16}
              aria-hidden="true"
              style={{ flexShrink: 0, color: T.ink.base }}
            />
            {footnote}
          </p>
          <nav aria-label="Legal and help" className="flex gap-5">
            {LEGAL_LINKS.map((link) => (
              <GlobalLink
                key={link.href}
                href={link.href}
                className="underline underline-offset-[3px] transition-colors hover:text-(--t-ink-base)"
                style={{ color: T.ink.dim }}
              >
                {link.label}
              </GlobalLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
