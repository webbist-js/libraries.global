import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import type { AnchorHTMLAttributes, ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import { routing } from "@/lib/navigation"

export const utilityButtonClass =
  "h-auto min-h-12 whitespace-normal rounded-full px-6 py-3 text-base"

/** A quiet, self-contained page for email actions and recovery states. */
export function UtilityPage({ children }: { children: ReactNode }) {
  const tUi = useUiTranslations("ui")

  return (
    <main
      className="flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10 sm:px-8 sm:py-16"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <span data-hide-footer="true" hidden />
      <section
        className="w-full max-w-[840px] rounded-[28px] border p-6 sm:rounded-[36px] sm:p-12 md:p-16"
        style={{ background: T.bg.deep, borderColor: T.border.line }}
      >
        <UtilityLink
          href="/"
          className="mb-10 inline-block text-[28px] leading-none sm:mb-12"
          style={{ fontFamily: T.font.serif }}
          aria-label="Libraries Global homepage"
        >
          {tUi("libraries")}
          <i>Global</i>
        </UtilityLink>
        {children}
      </section>
      <footer
        className="mt-6 flex max-w-[840px] flex-wrap justify-center gap-x-5 gap-y-2 text-sm leading-relaxed sm:mt-8"
        style={{ color: T.ink.dim }}
      >
        <UtilityLink
          href="/legal/privacy"
          className="underline underline-offset-4"
        >
          {tUi("privacy")}
        </UtilityLink>
        <UtilityLink
          href="/legal/terms"
          className="underline underline-offset-4"
        >
          Terms
        </UtilityLink>
        <UtilityLink href="/knowledge" className="underline underline-offset-4">
          {tUi("help")}{" "}
        </UtilityLink>
        <span>An independent, open-source project.</span>
      </footer>
    </main>
  )
}

export function UtilityHeading({
  title,
  italic,
  description,
  icon,
  tone = "info",
}: {
  title: string
  italic?: string
  description: ReactNode
  icon?: ReactNode
  tone?: "info" | "ok" | "warn" | "neutral"
}) {
  const tint = {
    info: { background: T.accent.chip, color: T.accent.primary },
    ok: { background: "var(--tint-public-bg)", color: T.accent.ok },
    warn: { background: "var(--tint-special-bg)", color: T.accent.danger },
    neutral: { background: T.bg.space, color: T.ink.dim },
  }[tone]

  return (
    <div className="mb-8">
      {icon && (
        <div
          aria-hidden="true"
          className="mb-5 flex size-16 items-center justify-center rounded-full"
          style={tint}
        >
          {icon}
        </div>
      )}
      <h1
        className="m-0 text-[clamp(2.6rem,6vw,4.2rem)] leading-[1.06] font-medium tracking-[-0.025em]"
        style={{ fontFamily: T.font.serif, overflowWrap: "anywhere" }}
      >
        {title}
        {italic && (
          <>
            {" "}
            <em className="font-normal">{italic}</em>
          </>
        )}
      </h1>
      <div
        className="mt-5 text-lg leading-relaxed [overflow-wrap:anywhere]"
        style={{ color: T.ink.dim }}
      >
        {description}
      </div>
    </div>
  )
}

export function UtilityPanel({ children }: { children: ReactNode }) {
  return (
    <div
      className="my-6 rounded-[20px] border p-5 text-base leading-relaxed [overflow-wrap:anywhere]"
      style={{ background: T.bg.surface, borderColor: T.border.line }}
    >
      {children}
    </div>
  )
}

/** A full navigation preserves the boundary between the public email shell and the app. */
export function UtilityLink({
  href,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string }) {
  const locale = useLocale()
  const localized =
    href.startsWith("/") &&
    !href.startsWith("//") &&
    locale !== routing.defaultLocale
      ? `/${locale}${href}`
      : href

  return <a href={localized} {...props} />
}
