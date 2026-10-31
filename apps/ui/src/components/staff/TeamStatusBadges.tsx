import { useTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"

/** Membership enables Team features; verification governs delegated staff authority. */
export function TeamStatusBadges({
  membership,
  verified,
}: {
  readonly membership?: "active" | "lapsed" | "expired"
  readonly verified?: boolean
}) {
  const t = useTranslations("staffWorkspace")

  return (
    <div className="flex flex-wrap items-center gap-2">
      {membership ? (
        <Badge
          label={t(
            membership === "active"
              ? "membershipActive"
              : membership === "lapsed"
                ? "membershipLapsed"
                : "membershipExpired"
          )}
          color={membership === "active" ? "ok" : "dim"}
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
