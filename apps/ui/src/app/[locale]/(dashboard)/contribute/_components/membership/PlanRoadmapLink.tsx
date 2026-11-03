import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import { Link } from "@/lib/navigation"
import { roadmapAnchor } from "@/lib/roadmap"

/** A compare row's label, with a link to its Roadmap item when it has one. */
export function PlanRowLabel({
  label,
  roadmapKey,
}: {
  readonly label: string
  readonly roadmapKey?: string
}) {
  const t = useUiTranslations("membershipCompare")

  if (!roadmapKey) return label

  return (
    <>
      {label}
      <Link
        href={`/community/roadmap#${roadmapAnchor(roadmapKey)}`}
        className="mt-1 flex w-fit items-center gap-1 text-sm font-medium text-(--t-accent-primary) underline-offset-2 hover:underline"
      >
        {t("roadmapLink")}
        <span className="sr-only">: {label}</span>
        <Icon
          aria-hidden="true"
          icon="mdi:arrow-right"
          width={14}
          height={14}
        />
      </Link>
    </>
  )
}
