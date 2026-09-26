import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

const OPEN_LINKS = [
  {
    title: "Source code",
    desc: "The whole platform is open source. Read it, fork it, improve it.",
    href: "https://github.com/libraries-global/libraries.global",
  },
  {
    title: "Contribution guide",
    desc: "How to add and edit records, and what counts as a good source.",
    href: "/contribute",
  },
  {
    title: "Data licence & export",
    desc: "Download the index under an open licence, with provenance.",
    href: "/docs",
  },
  {
    title: "Methodology",
    desc: "What we include, how we verify, and known gaps.",
    href: "/docs",
  },
] as const

export function OpenByDesignSection() {
  return (
    <section className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(48px,6vw,80px)] pb-[clamp(64px,8vw,104px)] sm:px-8">
      <h2
        className="m-0 mb-5"
        style={{
          fontFamily: T.font.serif,
          fontWeight: 500,
          fontSize: "clamp(28px,3vw,38px)",
          color: T.ink.base,
        }}
      >
        Open by design
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
        {OPEN_LINKS.map((link) => (
          <GlobalLink
            key={link.title}
            href={link.href}
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
              {link.desc}
            </span>
          </GlobalLink>
        ))}
      </div>
    </section>
  )
}

OpenByDesignSection.displayName = "OpenByDesignSection"

export default OpenByDesignSection
