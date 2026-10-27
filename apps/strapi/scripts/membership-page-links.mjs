import { membershipLink } from "@repo/shared-data"

const labels = {
  en: "Plans and pricing",
  fr: "Formules et tarifs",
  cs: "Plány a ceny",
}

/** Rewrite targets only; preserve component IDs, publication state and editorial copy. */
export function updateMembershipLinks(value, locale = "en") {
  if (typeof value === "string") {
    const exact = membershipLink(value)
    if (exact !== value) return exact

    return value.replaceAll(
      /(?:https?:\/\/(?:www\.)?libraries\.global)?\/(?:[^\s<>"'()[\]]+)/g,
      membershipLink
    )
  }
  if (Array.isArray(value))
    return value.map((entry) => updateMembershipLinks(entry, locale))
  if (!value || typeof value !== "object") return value
  const result = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      // IDs and route identities are never link targets. In particular a redirect's
      // source must remain the old URL, while its destination can change.
      ["source", "slug", "documentId", "id"].includes(key)
        ? item
        : updateMembershipLinks(item, locale),
    ])
  )
  if (
    typeof result.href === "string" &&
    /\/(?:plans)(?:[?#]|$)/.test(result.href) &&
    /^(?:Plans\s*(?:&|and)\s*Pro|Formules\s*(?:&|et)\s*Pro|Plány\s*[a&]\s*Pro)$/.test(
      result.label ?? ""
    )
  )
    result.label = labels[locale] ?? labels.en

  return result
}
