import { Badge } from "@/components/ds"
import { driveHref } from "@/lib/drives/drive-view"
import { Link } from "@/lib/navigation"

import type { DriveTag } from "./submissionMeta"

/**
 * A Submission's Drive, shown on a queue row and on the review page's
 * header: a tinted pill, "Drive: <title>", linking to the drive page.
 */
export function DriveChip({ drive }: { readonly drive: DriveTag }) {
  return (
    <Link href={driveHref(drive.slug)} className="no-underline">
      <Badge
        label={`Drive: ${drive.title}`}
        color="violet"
        icon="mdi:flag-checkered"
      />
    </Link>
  )
}
