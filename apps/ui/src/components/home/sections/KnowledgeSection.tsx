import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import type { CtaBand, LinkCard } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** One line pointing to the Knowledge hub: a few guides to start with, then
 * the hub itself. */
export function KnowledgeSection({
  band,
  links,
}: {
  readonly band: CtaBand
  readonly links: readonly LinkCard[]
}) {
  if (!band.title) return null

  return (
    <section
      aria-labelledby="knowledge-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,96px)] sm:px-8"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-y py-7"
        style={{ borderColor: T.border.line }}
      >
        <h2
          id="knowledge-title"
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            fontSize: "clamp(26px,2.3vw,34px)",
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            color: T.ink.base,
          }}
        >
          <Emphasis text={band.title} emStyle={{ color: T.accent.primary }} />
        </h2>

        <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
          {links.map((link) => (
            <li key={link.title}>
              <GlobalLink
                href={link.href ?? "/knowledge"}
                title={link.text ?? undefined}
                className="inline-block rounded-full border bg-white px-3.5 py-2 text-[14px] font-semibold no-underline transition-colors hover:border-(--t-accent-primary) hover:text-(--t-accent-primary)"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              >
                {link.title}
              </GlobalLink>
            </li>
          ))}
          {band.primaryLabel && band.primaryHref ? (
            <li className="pl-2">
              <GlobalLink
                href={band.primaryHref}
                className="text-[14px] font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                {band.primaryLabel} <span aria-hidden="true">→</span>
              </GlobalLink>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  )
}

KnowledgeSection.displayName = "KnowledgeSection"

export default KnowledgeSection
