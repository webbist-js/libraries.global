import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

import { KeyValueList } from "./KeyValueList"

/**
 * A Library Claim: who the claimant says they are, and whether their email
 * domain matches the library's website (the domain check). Approving
 * records the affiliation and raises them to Verified librarian.
 */
export function ClaimPanel({
  fields: raw,
  targetSlug,
}: {
  readonly fields: unknown
  readonly targetSlug: string | null
}) {
  const f = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >
  const userDomain =
    typeof f.userEmailDomain === "string" ? f.userEmailDomain : ""
  const siteDomain =
    typeof f.libraryWebsiteDomain === "string" ? f.libraryWebsiteDomain : ""
  const hasDomains = !!(userDomain && siteDomain)
  const match =
    hasDomains && userDomain.toLowerCase() === siteDomain.toLowerCase()

  return (
    <div className="flex flex-col gap-4">
      {hasDomains ? (
        <div
          className="flex items-start gap-2.5 rounded-[14px] px-4 py-3 text-[14px] leading-[1.55]"
          style={{
            background: match ? "var(--tint-public-bg)" : "#F5EEDC",
            color: match ? T.accent.ok : "#6B5420",
          }}
        >
          <Icon
            aria-hidden="true"
            icon={match ? "mdi:check-decagram-outline" : "mdi:alert-outline"}
            width={20}
            height={20}
            className="mt-0.5 shrink-0"
          />
          <div>
            <p className="m-0 font-semibold">
              {match ? "Domain match" : "Domain mismatch"}
            </p>
            <p className="m-0">
              {match
                ? `The claimant's email domain (${userDomain}) matches the library's website.`
                : `The claimant's email domain (${userDomain}) doesn't match the library's website (${siteDomain}). Verify by another route before approving.`}
            </p>
          </div>
        </div>
      ) : (
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          No domain check: the claim has no email or website domain to compare.
        </p>
      )}
      <KeyValueList
        rows={[
          { label: "Library", value: f.name ?? targetSlug ?? "" },
          { label: "Entity ref", value: f.entityRef ?? "" },
          {
            label: "Role",
            value:
              typeof f.role === "string" ? f.role.replaceAll("_", " ") : "",
          },
          { label: "Department", value: f.department ?? "" },
          { label: "Verification method", value: f.verificationMethod ?? "" },
          { label: "User email domain", value: userDomain },
          {
            label: "Website given by claimant (unverified)",
            value: siteDomain || (f.claimedWebsiteDomain ?? ""),
          },
        ].filter((r) => r.value)}
      />
      <p
        className="m-0 text-[14px] leading-[1.55]"
        style={{ color: T.ink.dim }}
      >
        Approving records the affiliation and raises the claimant to Verified
        librarian. Roles are never lowered.
      </p>
    </div>
  )
}
