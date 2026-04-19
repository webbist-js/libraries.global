import { Card, Eyebrow, SectionHeader, StatBlock } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"

// TODO: Replace hardcoded values with real data when:
// - UNMAPPED: computed from total libraries minus indexed libraries
// - CONTRIBUTORS: available when auth/user system ships
// - EDITS TODAY: available when edit tracking ships
// - COUNTRIES: fetch from Strapi continent/country counts
const CONTRIBUTE_STATS = [
  { value: "76,440", label: "UNMAPPED" },
  { value: "9,274", label: "CONTRIBUTORS" },
  { value: "1,284", label: "EDITS TODAY" },
  { value: "228", label: "COUNTRIES" },
] as const

export function ContributeCTA() {
  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0c1228] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_32px_80px_rgba(0,0,0,0.4)]">
          <div className="relative overflow-hidden px-8 py-12 sm:px-12 sm:py-16">
            {/* Single very subtle purple glow — bottom-right only */}
            <div className="pointer-events-none absolute right-0 bottom-0 h-[480px] w-[480px] translate-x-1/3 translate-y-1/3 rounded-full bg-[radial-gradient(circle,rgba(88,80,200,0.09),transparent_65%)]" />

            <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-20">
              {/* Left: copy + CTAs */}
              <div>
                <div style={{ marginBottom: "20px" }}>
                  <Eyebrow index={4}>Contribute</Eyebrow>
                </div>
                <div style={{ marginBottom: "24px" }}>
                  <SectionHeader as="h2" italic="the complete index.">
                    Help us build
                    <br />
                  </SectionHeader>
                </div>
                <p className="mb-8 max-w-[38ch] text-[15px] leading-7 text-white/50">
                  There are 76,440 libraries not yet in the index. If you work
                  at one, visit one, or steward one — claim its page and add its
                  record. Every correction, photograph, and hours update
                  compounds.
                </p>
                <div className="flex flex-wrap gap-3">
                  <GlobalLink
                    href="/contribute"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-slate-950 shadow-[0_4px_24px_rgba(255,255,255,0.14)] transition-all hover:bg-white/92 hover:shadow-[0_4px_32px_rgba(255,255,255,0.2)]"
                  >
                    Claim a library →
                  </GlobalLink>
                  <GlobalLink
                    href="/contribute/guide"
                    className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/[0.05] px-7 py-3 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.09] hover:text-white"
                  >
                    Read the contributor guide
                  </GlobalLink>
                </div>
              </div>

              {/* Right: stat grid */}
              <div className="grid grid-cols-2 gap-2.5 lg:w-[380px] lg:flex-none">
                {CONTRIBUTE_STATS.map((stat) => (
                  <Card key={stat.label} style={{ padding: "24px" }}>
                    <StatBlock
                      value={stat.value}
                      label={stat.label}
                      size="lg"
                    />
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

ContributeCTA.displayName = "ContributeCTA"

export default ContributeCTA
