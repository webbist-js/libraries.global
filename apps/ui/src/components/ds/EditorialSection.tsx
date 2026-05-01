import Image from "next/image"

import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

// ── Minimal structural interface ──────────────────────────────────────────────
// Covers ContinentEditorialBlock, EditorialBlock — all share these fields.

interface EditorialSectionData {
  image?: { url?: string | null; alternativeText?: string | null } | null
  imagePosition?: string | null
  eyebrow?: string | null
  title: string
  body?: unknown
  primaryCtaLabel?: string | null
  primaryCtaUrl?: string | null
  secondaryCtaLabel?: string | null
  secondaryCtaUrl?: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditorialSection({
  section,
}: {
  readonly section: EditorialSectionData
}) {
  const imageUrl = section.image?.url
    ? formatStrapiMediaUrl(section.image.url)
    : null
  const isImageLeft = section.imagePosition === "left"

  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div
          className={cn(
            "grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center",
            isImageLeft && imageUrl ? "lg:[&>*:first-child]:order-2" : ""
          )}
        >
          {/* Text */}
          <div className="flex flex-col gap-5">
            {section.eyebrow ? (
              <span className="text-[11px] font-semibold tracking-[0.16em] text-(--t-accent-aurora) uppercase opacity-70">
                {section.eyebrow}
              </span>
            ) : null}
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] leading-[1.05] font-bold tracking-[-0.03em] text-(--t-ink-base)">
              {section.title}
            </h2>
            {Array.isArray(section.body) && section.body.length > 0 ? (
              <div className="max-w-[52ch] text-(--t-ink-dim)">
                <StrapiBlocksContent
                  blocks={
                    section.body as Parameters<
                      typeof StrapiBlocksContent
                    >[0]["blocks"]
                  }
                />
              </div>
            ) : null}
            {(section.primaryCtaLabel && section.primaryCtaUrl) ||
            (section.secondaryCtaLabel && section.secondaryCtaUrl) ? (
              <div className="flex flex-wrap gap-3 pt-2">
                {section.primaryCtaLabel && section.primaryCtaUrl ? (
                  <GlobalLink
                    href={section.primaryCtaUrl}
                    className="inline-flex items-center gap-2 rounded-2xl border border-(--t-aurora-edge) bg-(--t-aurora-soft) px-5 py-2.5 text-sm font-semibold text-(--t-accent-aurora) transition-colors hover:opacity-80"
                  >
                    {section.primaryCtaLabel}
                  </GlobalLink>
                ) : null}
                {section.secondaryCtaLabel && section.secondaryCtaUrl ? (
                  <GlobalLink
                    href={section.secondaryCtaUrl}
                    className="inline-flex items-center gap-2 rounded-2xl border border-(--t-border-hi) bg-(--t-bg-surface) px-5 py-2.5 text-sm font-semibold text-(--t-ink-dim) transition-colors hover:bg-(--t-bg-deep) hover:text-(--t-ink-base)"
                  >
                    {section.secondaryCtaLabel}
                  </GlobalLink>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Image */}
          {imageUrl ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-(--t-border-line)">
              <Image
                src={imageUrl}
                alt={section.image?.alternativeText ?? section.title}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.05),rgba(5,8,22,0.3))]" />
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  )
}
