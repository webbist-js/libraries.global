import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import { LocationSectionHeading } from "@/components/location/LocationHero"
import { T } from "@/lib/design-tokens"

type Blocks = Parameters<typeof StrapiBlocksContent>[0]["blocks"]

/**
 * Optional hand-written context for a continent or country (the CMS `about`
 * field) — how its library systems are organised, legal deposit, history.
 * Renders nothing when empty: these pages are programmatic by default.
 */
export function LocationAbout({
  name,
  about,
}: {
  readonly name: string
  readonly about: unknown
}) {
  if (!Array.isArray(about) || about.length === 0) return null

  return (
    <section id="about" className="scroll-mt-28">
      <LocationSectionHeading title={`About libraries in ${name}`} />
      <div
        className="rounded-3xl px-7 py-7 text-[17px] leading-[1.7] sm:px-9"
        style={{
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
          color: T.ink.dim,
        }}
      >
        <div className="max-w-[68ch]">
          <StrapiBlocksContent blocks={about as Blocks} />
        </div>
      </div>
    </section>
  )
}

export function hasLocationAbout(about: unknown): boolean {
  return Array.isArray(about) && about.length > 0
}
