import { T } from "@/lib/design-tokens"

import { Eyebrow } from "./Eyebrow"
import { SectionHeader } from "./SectionHeader"

// ── Component ─────────────────────────────────────────────────────────────────

export function MapSectionHeader({
  locationName,
  index = 3,
}: {
  readonly locationName: string
  readonly index?: number
}) {
  return (
    <>
      <div style={{ marginBottom: "22px" }}>
        <Eyebrow index={index} bar>
          Geographic index
        </Eyebrow>
      </div>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-6">
        <SectionHeader italic={`${locationName}.`} as="h2">
          Libraries in
        </SectionHeader>
        <p
          style={{
            color: T.ink.dim,
            fontSize: "14px",
            lineHeight: "1.7",
            fontWeight: 300,
            maxWidth: "52ch",
            margin: 0,
          }}
        >
          Pillar institutions are marked in gold. Click a pin to open the
          library card, or zoom to reveal public libraries.
        </p>
      </div>
    </>
  )
}
