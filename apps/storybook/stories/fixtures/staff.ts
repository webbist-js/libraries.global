import type { MySubmissionRow } from "@/lib/role-application"

/** Synthetic claims only; no account, session or live service is involved. */
export const staffAccessRequests: MySubmissionRow[] = [
  {
    documentId: "example-pending-claim",
    submissionType: "library_claim",
    status: "pending",
    fields: { name: "Example Central Library" },
  },
  {
    documentId: "example-draft-claim",
    submissionType: "library_claim",
    status: "draft",
    targetLabel: "Example Mobile Library",
  },
  {
    documentId: "example-information-request",
    submissionType: "library_claim",
    status: "needs_info",
    fields: { name: "Example Archive and Community Reading Room" },
  },
]
