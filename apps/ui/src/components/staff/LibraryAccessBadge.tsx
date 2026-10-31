import { useTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"

/** Review state is independent of Team membership, verification and coverage. */
function libraryAccessStatus(status: string) {
  switch (status) {
    case "approved":
      return {
        key: "accessApproved",
        color: "ok",
        icon: "mdi:shield-check-outline",
      } as const
    case "invited":
      return {
        key: "accessOnAcceptance",
        color: "dim",
        icon: "mdi:email-outline",
      } as const
    case "draft":
      return {
        key: "accessDraft",
        color: "dim",
        icon: "mdi:pencil-outline",
      } as const
    case "pending":
      return {
        key: "accessPending",
        color: "warn",
        icon: "mdi:clock-outline",
      } as const
    case "needs_info":
      return {
        key: "accessNeedsInfo",
        color: "warn",
        icon: "mdi:message-alert-outline",
      } as const

    default:
      return {
        key: "accessUnknown",
        color: "dim",
        icon: "mdi:help-circle-outline",
      } as const
  }
}

/** Wrap qualified status labels within narrow cards and translated layouts. */
export function LibraryAccessBadge({ status }: { readonly status: string }) {
  const t = useTranslations("staffWorkspace")
  const state = libraryAccessStatus(status)

  return (
    <Badge
      label={t(state.key)}
      color={state.color}
      icon={state.icon}
      style={{
        maxWidth: "100%",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
      }}
    />
  )
}
