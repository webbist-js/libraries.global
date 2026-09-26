import GlobalLink from "@/components/global/GlobalLink"
import type { LinkCard, SectionIntro } from "@/components/home/homepage.types"
import { KOFI_URL } from "@/lib/constants"
import { T } from "@/lib/design-tokens"

export function OpenByDesignSection({
  intro,
  links,
}: {
  readonly intro: SectionIntro
  readonly links: readonly LinkCard[]
}) {
  return (
    <section
      aria-labelledby="open-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <h2
        id="open-title"
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontWeight: 500,
          fontSize: "clamp(28px,3vw,38px)",
          color: T.ink.base,
        }}
      >
        {intro.title}
      </h2>
      {intro.text ? (
        <p
          className="mt-2 mb-0 max-w-[620px] text-[16px] leading-[1.6]"
          style={{ color: T.ink.dim }}
        >
          {intro.text}
        </p>
      ) : null}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <GlobalLink
            key={link.title}
            href={link.href ?? "/docs"}
            className="flex flex-col gap-1.5 rounded-[18px] border bg-white p-5 no-underline transition-colors hover:border-(--t-accent-primary)"
            style={{ borderColor: T.border.line }}
          >
            <span
              className="text-[17px] font-bold"
              style={{ color: T.ink.base }}
            >
              {link.title} →
            </span>
            <span
              className="text-[15px] leading-[1.5]"
              style={{ color: T.ink.dim }}
            >
              {link.text}
            </span>
          </GlobalLink>
        ))}
      </div>
      <p className="mt-5 mb-0 text-[15px]" style={{ color: T.ink.dim }}>
        Open doesn&rsquo;t mean free to run. If the index is useful to you,{" "}
        <GlobalLink
          href={KOFI_URL}
          className="font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          support it on Ko-fi
          <span className="sr-only"> (opens in a new tab)</span>
        </GlobalLink>
        .
      </p>
    </section>
  )
}

OpenByDesignSection.displayName = "OpenByDesignSection"

export default OpenByDesignSection
