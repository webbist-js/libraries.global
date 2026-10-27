export async function networkRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`/api/networks${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    signal,
  })
  const json = await response.json()
  if (!response.ok)
    throw new Error(
      json.error?.message ??
        NETWORK_ERRORS[json.error?.code] ??
        "The request could not be completed. Please try again."
    )

  return json as T
}
const NETWORK_ERRORS: Record<string, string> = {
  scope_already_approved:
    "You already have this scope. Use your approved service card to manage access, or request new libraries or owner responsibility.",
  affiliation_already_verified:
    "This employment affiliation is already verified.",
  claim_pending:
    "There is already a request for this service. Open your submissions to update it when more information is requested.",
  organiser_required:
    "A current Team organiser must connect this request to the Team.",
  network_membership_changed:
    "The source membership changed. Reload and review the libraries again.",
  version_conflict: "This case changed. Reload before trying again.",
  consortium_has_no_branch_authority:
    "Consortium affiliation can be verified, but membership does not grant management of its branches.",
  network_scope_too_large:
    "This service needs an administrator to review its scope.",
}
