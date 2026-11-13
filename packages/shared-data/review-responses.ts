/** Curated drafts only: choosing a response never makes a review decision. */
export type ReviewResponseContext = {
  submissionType?: string
  itemName?: string
}

export type ReviewResponse = { id: string; label: string; text: string }

const DETAILS: Record<string, [string, string]> = {
  correction: [
    "Confirm the change",
    "Please link to a current source that confirms the proposed correction and say which details it supports.",
  ],
  library_edit: [
    "Confirm the details",
    "Please add a current library or service webpage supporting the changed details. For opening hours, include the days and any seasonal exceptions.",
  ],
  new_library: [
    "Complete the library details",
    "Please add the library’s official name, location and a public source confirming that it operates as a library. This will help us check the record before adding it.",
  ],
  library_claim: [
    "Confirm your connection",
    "Please provide a public staff page or another way for us to verify your connection to this library and the access you need. Please do not send passwords or identity documents.",
  ],
  network_claim: [
    "Confirm service coverage",
    "Please provide an official service or network page listing the libraries covered, and a way for us to verify your role. Please do not send passwords or identity documents.",
  ],
  role_application: [
    "Clarify your experience",
    "Please tell us which areas you would like to help with and share a relevant example of your work or experience. This will help us assess the requested role.",
  ],
  wiki_edit: [
    "Add supporting references",
    "Please add reliable references for the factual claims in this Knowledge contribution and make clear which statements each source supports.",
  ],
  blog_submission: [
    "Refine the article",
    "Please clarify the article’s main point and its relevance to libraries. Add sources for factual claims and credits or permission details for any images.",
  ],
  topic_suggestion: [
    "Clarify the topic",
    "Please explain the proposed topic’s scope and how it differs from existing topics, with an example of the content it would include.",
  ],
  event_feed: [
    "Check the feed",
    "Please provide a publicly accessible feed URL and confirm which library or service publishes it. Include an example event so we can check dates, locations and time zones.",
  ],
  drive_proposal: [
    "Define the drive",
    "Please clarify the drive’s geographic scope, the information contributors should collect and the sources they should use. Include a clear completion goal.",
  ],
  option_suggestion: [
    "Clarify the feature",
    "Please describe what this feature means in practice and give an example of a library offering it. Explain how it differs from the existing options.",
  ],
}

export function reviewResponses({
  submissionType,
  itemName,
}: ReviewResponseContext): ReviewResponse[] {
  const [label, detail] = DETAILS[submissionType ?? ""] ?? [
    "Add more detail",
    "Please explain the proposed change and add a reliable source or example so we can review it.",
  ]
  const subject = itemName?.trim()
    ? `“${itemName.trim()}”`
    : "your contribution"

  return [
    { id: "details", label, text: `Thank you for ${subject}. ${detail}` },
    {
      id: "source",
      label: "Request a verifiable source",
      text: `Thank you for ${subject}. Please add a publicly accessible, reliable source that directly supports the information submitted. If the source has changed, include the date you checked it.`,
    },
    {
      id: "duplicate",
      label: "Explain an overlap",
      text: `Thank you for ${subject}. This appears to overlap with an existing item. Please review the related entry and explain what new information your contribution adds, or suggest an update to that entry.`,
    },
    {
      id: "scope",
      label: "Explain why it does not fit",
      text: `Thank you for ${subject}. We cannot take this forward in its current form because its relevance to libraries is not clear. Please explain the connection and narrow the contribution to information that readers can use and verify.`,
    },
  ]
}

/** Preserve the reviewer's existing text and refuse insertion beyond the field limit. */
export function appendReviewResponse(
  note: string,
  response: string,
  maxLength = 2000
): string | null {
  const next = note.trim() ? `${note.trimEnd()}\n\n${response}` : response

  return next.length <= maxLength ? next : null
}
