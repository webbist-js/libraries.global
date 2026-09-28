import GlobalLink from "@/components/global/GlobalLink"
import type { LinkCard, SectionIntro } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** A quiet closing line of links: the platform's open commitments. */
export function OpenByDesignSection({
  intro,
  links,
}: {
  readonly intro: SectionIntro
  readonly links: readonly LinkCard[]
}) {
  if (links.length === 0) return null

  return (
    <nav
      aria-labelledby="open-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-[clamp(56px,7vw,88px)] sm:px-8"
    >
      <div className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-2 text-[15px]">
        <h2
          id="open-title"
          className="m-0 text-[15px] font-bold"
          style={{ color: T.ink.base }}
        >
          {intro.title}:
        </h2>
        <ul className="m-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-2 p-0">
          {links.map((link) => (
            <li key={link.title}>
              <GlobalLink
                href={link.href ?? "/knowledge"}
                title={link.text ?? undefined}
                className="underline underline-offset-[3px] transition-colors hover:text-(--t-accent-primary)"
                style={{ color: T.ink.dim }}
              >
                {link.title}
              </GlobalLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

OpenByDesignSection.displayName = "OpenByDesignSection"

export default OpenByDesignSection
