import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"

export interface LocationContributeCTAProps {
  locationName?: string
  entityType?: "continent" | "country" | "region" | "area" | "library"
}

export function LocationContributeCTA({
  locationName = "this area",
  entityType,
}: LocationContributeCTAProps) {
  const isLibrary = entityType === "library"

  const heading = isLibrary
    ? `Know something we don't?`
    : `Help keep ${locationName}'s index current.`

  const body = isLibrary
    ? `Spotted an error, a missing opening time, or a new service? Help us keep the ${locationName} page accurate and up to date.`
    : `We track every institution holding more than 1,000 volumes. Missing a village library? A closed archive? Help us keep things moving to an organized record.`

  const primaryLabel = isLibrary ? "Submit a correction" : "Propose an addition"
  const secondaryLabel = isLibrary
    ? "Suggest a missing detail →"
    : "Submit a correction →"

  return (
    <section className="py-14 sm:py-18">
      <Container>
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c1228] px-8 py-10 shadow-[0_32px_80px_rgba(0,0,0,0.4)] sm:px-12 sm:py-12">
          {/* Subtle glow */}
          <div className="pointer-events-none absolute right-0 bottom-0 h-[480px] w-[480px] translate-x-1/3 translate-y-1/3 rounded-full bg-[radial-gradient(circle,rgba(88,80,200,0.08),transparent_65%)]" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[48ch]">
              <h2 className="mb-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {isLibrary ? heading : <>{heading}</>}
              </h2>
              <p className="text-[15px] leading-relaxed text-white/60">
                {body}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {/* TODO: wire up /contribute routes with entity context */}
              <GlobalLink
                href="/contribute"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_4px_24px_rgba(255,255,255,0.14)] transition-all hover:bg-white/92 hover:shadow-[0_4px_32px_rgba(255,255,255,0.2)]"
              >
                {primaryLabel}
              </GlobalLink>
              <GlobalLink
                href="/contribute/guide"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/16 bg-white/[0.05] px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/[0.09]"
              >
                {secondaryLabel}
              </GlobalLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
