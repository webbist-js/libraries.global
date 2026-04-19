import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"

export function ContentSection({
  eyebrow,
  title,
  text,
  ctaLabel,
  ctaHref,
}: {
  readonly eyebrow?: string | null
  readonly title?: string | null
  readonly text?: string | null
  readonly ctaLabel?: string | null
  readonly ctaHref?: string | null
}) {
  if (!title && !text) return null

  return (
    <section className="py-16 sm:py-24" id="about">
      <Container>
        <div className="max-w-[52rem]">
          {eyebrow ? (
            <p className="mb-5 font-mono text-[11px] tracking-[0.22em] text-white/35 uppercase">
              § 02 — {eyebrow.toUpperCase()}
            </p>
          ) : null}
          {title ? (
            <h2 className="mb-6 font-[family-name:var(--font-fraunces)] text-[2.4rem] leading-[1.08] font-semibold tracking-[-0.02em] text-white sm:text-[3.2rem]">
              {title}
            </h2>
          ) : null}
          {text ? (
            <p className="mb-8 max-w-[58ch] text-base leading-8 text-white/55 sm:text-lg">
              {text}
            </p>
          ) : null}
          {ctaHref && ctaLabel ? (
            <GlobalLink
              href={ctaHref}
              className="inline-flex items-center gap-2 text-sm font-medium text-cyan-400/80 underline-offset-4 transition-colors hover:text-cyan-300 hover:underline"
            >
              {ctaLabel} →
            </GlobalLink>
          ) : null}
        </div>
      </Container>
    </section>
  )
}

ContentSection.displayName = "ContentSection"

export default ContentSection
