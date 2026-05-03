import { Card, Eyebrow, SectionHeader, StatBlock } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"

// Rough estimate of the total number of significant libraries worldwide.
// Used to compute the "UNMAPPED" stat: how many haven't been indexed yet.
const LIBRARY_UNIVERSE_ESTIMATE = 320_000

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

async function fetchContributeStats() {
  try {
    const res = await fetch(
      `${STRAPI}/api/content-moderation/submissions/stats`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      data: {
        submissionsToday: number
        indexedLibraries: number
        totalContributors: number
        totalCountries: number
      }
    }

    return json.data
  } catch {
    return null
  }
}

export async function ContributeCTA() {
  const stats = await fetchContributeStats()
  const unmapped = stats
    ? Math.max(0, LIBRARY_UNIVERSE_ESTIMATE - stats.indexedLibraries)
    : null

  const displayStats = [
    {
      value: unmapped != null ? unmapped.toLocaleString() : "—",
      label: "UNMAPPED",
    },
    {
      value: stats ? stats.totalContributors.toLocaleString() : "—",
      label: "CONTRIBUTORS",
    },
    {
      value: stats ? stats.submissionsToday.toLocaleString() : "—",
      label: "EDITS TODAY",
    },
    {
      value: stats ? stats.totalCountries.toLocaleString() : "—",
      label: "COUNTRIES",
    },
  ]

  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div className="overflow-hidden rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_32px_80px_rgba(0,0,0,0.15)]">
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
                <p className="mb-8 max-w-[38ch] text-[15px] leading-7 text-(--t-ink-low)">
                  There are{" "}
                  {unmapped != null
                    ? unmapped.toLocaleString()
                    : "thousands of"}{" "}
                  libraries not yet in the index. If you work at one, visit one,
                  or steward one — claim its page and add its record. Every
                  correction, photograph, and hours update compounds.
                </p>
                <div className="flex flex-wrap gap-3">
                  <GlobalLink
                    href="/contribute"
                    className="inline-flex items-center gap-2 rounded-full bg-(--t-ink-base) px-7 py-3 text-sm font-semibold text-(--t-bg-void) shadow-[0_4px_24px_rgba(0,0,0,0.14)] transition-all hover:opacity-90"
                  >
                    Claim a library →
                  </GlobalLink>
                  <GlobalLink
                    href="/wiki"
                    className="inline-flex items-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-surface) px-7 py-3 text-sm font-medium text-(--t-ink-dim) transition-all hover:bg-(--t-bg-deep) hover:text-(--t-ink-base)"
                  >
                    Browse the knowledge base
                  </GlobalLink>
                </div>
              </div>

              {/* Right: stat grid */}
              <div className="grid grid-cols-2 gap-2.5 lg:w-[380px] lg:flex-none">
                {displayStats.map((stat) => (
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
