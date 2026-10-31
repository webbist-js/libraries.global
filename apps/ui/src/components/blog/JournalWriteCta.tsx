import { useTranslations } from "next-intl"

import { ActionCallout } from "@/components/ds/ActionCallout"

export function JournalWriteCta({
  headingId = "journal-contribute",
}: {
  readonly headingId?: string
}) {
  const t = useTranslations("editorial")

  return (
    <ActionCallout
      headingId={headingId}
      eyebrow={t("pitchEyebrow")}
      title={t("pitchTitle")}
      action={{
        label: t("pitchStory"),
        href: "/contribute/knowledge?type=journal",
      }}
    >
      {t("pitchIntro")}
    </ActionCallout>
  )
}

export default JournalWriteCta
