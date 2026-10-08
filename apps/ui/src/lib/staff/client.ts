export async function staffRequest<T = unknown>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method === "DELETE" ? {} : { body: JSON.stringify(body ?? {}) }),
  })
  const value = response.status === 204 ? null : await response.json()
  if (!response.ok) {
    const code = value?.error?.code ?? value?.error ?? "request_failed"
    const messages: Record<string, string> = {
      last_owner:
        "The last owner cannot leave, be removed or become an editor.",
      email_failed:
        "The invitation email could not be sent. Try again shortly.",
      email_mismatch: "Sign in with the email address this invite was sent to.",
      invite_unavailable: "This invite is no longer available.",
      email_verification_required:
        "Verify your email address before accepting this invite.",
      forbidden: "You do not have access to this action.",
      not_found: "Your staff access has changed. Reload this page.",
      upgrade_required: "This action needs the Team plan.",
      invalid_message: "Write a message between 10 and 1,000 characters.",
      moderators_email_not_configured:
        "Staff access reports are temporarily unavailable.",
      no_seats: "The team has no free seats. Ask your organiser to add one.",
      already_member: "They are already on the team.",
      invite_already_pending: "An invite for that email is already pending.",
      invalid_email: "Enter a valid email address.",
      library_not_in_team: "That library is not one of the team's.",
      team_inactive: "The team is lapsed or has expired.",
      member_not_active: "They haven't accepted their invite yet.",
      claim_pending:
        "A claim for that library is already waiting for a moderator.",
      last_organiser: "A team needs at least one organiser.",
      cannot_remove_self: "You can't remove yourself from the team.",
      not_invited: "That invite has already been accepted or revoked.",
      email_not_configured: "Invites are temporarily unavailable.",
    }
    throw new Error(
      messages[String(code)] ?? "The change could not be saved. Try again."
    )
  }

  return value as T
}
