/** Update access mechanics while preserving the document's operator and provider details. */
export function betaInvitationNotice(document) {
  const result = structuredClone(document)
  const replacements = [
    [
      "Entering the shared beta password",
      "Redeeming an individual invitation remembers access in this browser for up to 30 days. Invitations can be used once and expire after seven days. This does not sign you in, create an account, grant staff permissions or buy a membership. Creating an account is a separate step under the standard site terms, including the requirement to be 18 or over.",
    ],
    [
      "If you request beta access, we store",
      "If you request beta access, we store your email address, preferred language, request time and a record of what you requested. We use your consent to contact you about that access. When an invitation is issued, we record its issuance, sending, expiry, acceptance and revocation against your request. We store a hash of its unique code and temporarily encrypt that code until the email is sent or the invitation ends. An accepted browser pass references this invitation so it can be checked and revoked. These records show redemption of the invitation; they do not verify the identity of the person using it. Joining does not create an account or subscribe you to newsletters, product updates or marketing. Email us to withdraw the request or ask for deletion; withdrawal does not affect processing already carried out.",
    ],
    [
      "After you enter the invitation password",
      "After you redeem an invitation, the essential lg-beta-access cookie stores a signed invitation reference, expiry and access version. It contains no email address or account identifier and lasts up to 30 days. It is protected from script access and sent securely over HTTPS in production. We check its referenced invitation to enforce expiry, withdrawal and revocation. Rotating the signing secret or access version invalidates existing passes. Clearing or blocking the cookie, or using another browser, requires a replacement invitation; a used code cannot be redeemed again.",
    ],
  ]
  function visit(value) {
    if (Array.isArray(value)) return value.map(visit)
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== "id")
          .map(([key, item]) => [key, visit(item)])
      )
    if (typeof value !== "string") return value
    for (const [prefix, text] of replacements)
      if (value.startsWith(prefix)) return text

    return value
      .replaceAll("shared invitation password", "individual invitation")
      .replaceAll("invitation password publicly", "invitation code publicly")
  }
  result.sections = visit(result.sections)

  return result.sections
}
