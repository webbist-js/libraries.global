import { DriveCard } from "@/components/drives/DriveCard"
import { LocationSectionHeading } from "@/components/location/LocationHero"
import { T } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"

const fmt = (n: number) => n.toLocaleString("en-GB")

/**
 * "Drives here": up to three open drives with work still to do at this
 * place, on the continent, country and region pages. Renders nothing when
 * there's none.
 */
export function DrivesHere({
  placeName,
  items,
}: {
  readonly placeName: string
  readonly items: readonly { view: DriveView; here: number }[]
}) {
  if (items.length === 0) return null

  return (
    <section id="drives-here" className="scroll-mt-24">
      <LocationSectionHeading
        title="Drives here"
        description={`Open drives with work to do in ${placeName}.`}
      />
      <ul
        className="m-0 grid list-none gap-3.5 p-0"
        style={{
          gridTemplateColumns:
            "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
        }}
      >
        {items.map(({ view, here }) => (
          <li key={view.drive.documentId} className="flex flex-col gap-2">
            <DriveCard view={view} />
            <p className="m-0 text-[13.5px]" style={{ color: T.ink.dim }}>
              {fmt(here)} to do in {placeName}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
