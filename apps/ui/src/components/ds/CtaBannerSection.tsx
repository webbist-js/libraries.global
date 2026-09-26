import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"

// ── Minimal structural interface ──────────────────────────────────────────────
// Covers ContinentCtaBanner and CtaBanner — both share these fields.

interface CtaBannerData {
  title: string
  subtitle?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CtaBannerSection({
  section,
}: {
  readonly section: CtaBannerData
}) {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(67,56,202,0.08),transparent_70%)]" />
      <Container>
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className="text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] font-bold tracking-[-0.04em] text-(--t-ink-base)">
            {section.title}
          </h2>
          {section.subtitle ? (
            <p className="max-w-[42ch] text-base leading-7 text-(--t-ink-dim)">
              {section.subtitle}
            </p>
          ) : null}
          {section.ctaLabel && section.ctaUrl ? (
            <GlobalLink
              href={section.ctaUrl}
              className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-(--t-aurora-edge) bg-(--t-aurora-soft) px-7 py-3 text-sm font-semibold text-(--t-accent-aurora) transition-colors hover:opacity-80"
            >
              {section.ctaLabel}
            </GlobalLink>
          ) : null}
        </div>
      </Container>
    </section>
  )
}
