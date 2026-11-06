import { useTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"

/**
 * Whether the free staff workspace is open, and whether it is verified.
 * Neither grants library editing: that comes from each person's own
 * verified staff claims.
 */
export function TeamStatusBadges({
  workspace,
  verified,
}: {
  readonly workspace?: "open" | "closed"
  readonly verified?: boolean
}) {
  const t = useTranslations("staffWorkspace")

  return (
    <div className="flex flex-wrap items-center gap-2">
      {workspace ? (
        <Badge
          label={t(workspace === "open" ? "workspaceOpen" : "workspaceClosed")}
          color={workspace === "open" ? "ok" : "dim"}
          style={{
            maxWidth: "100%",
            whiteSpace: "normal",
            overflowWrap: "anywhere",
          }}
        />
      ) : null}
      {verified !== undefined ? (
        <Badge
          label={t(verified ? "verified" : "notVerified")}
          color={verified ? "ok" : "warn"}
          style={{
            maxWidth: "100%",
            whiteSpace: "normal",
            overflowWrap: "anywhere",
          }}
          icon={verified ? "mdi:check-decagram-outline" : "mdi:shield-outline"}
        />
      ) : null}
    </div>
  )
}
