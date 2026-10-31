import type { LibraryEditorBootstrap } from "@/components/library-editor/wizard.types"
import type { Submission } from "@/hooks/useSubmissions"

import { libraryResponses } from "./geography/library"
import { wizardForm } from "./geography/mobile"

export const editorSlug = "northbridge-community-library"
export const editorBootstrap = {
  initialData: {
    ...wizardForm,
    evidenceType: "institutional_url",
    evidenceUrl: "https://example.invalid/library",
  },
  target: {
    documentId: "example-library",
    slug: editorSlug,
    name: wizardForm.name,
    entityRef: null,
    isClaimed: false,
    completeSections: [],
  },
  locale: { code: "en", defaultCode: "en", languageName: "English" },
  staffHref: null,
} satisfies LibraryEditorBootstrap
export const editorSubmission = {
  documentId: "example-submission",
  submissionType: "correction",
  status: "pending",
  targetSlug: editorSlug,
  targetDocumentId: "example-library",
  locale: "en",
  editSummary: "Correct the library name",
  evidenceType: "institutional_url",
  evidenceUrl: "https://example.invalid/library",
  fields: {
    kind: "record",
    name: "Northbridge Library and Reading Room",
    previous: { name: wizardForm.name },
  },
  draftData: {
    ...editorBootstrap.initialData,
    name: "Northbridge Library and Reading Room",
    editSummary: "Correct the library name",
    kind: "record",
    previous: editorBootstrap.initialData,
  },
  stepCompleted: 6,
  createdAt: "2026-10-30T10:00:00Z",
  updatedAt: "2026-10-30T13:00:00Z",
} satisfies Submission
export const editorResponses = {
  ...libraryResponses,
  [`GET /api/contribute/library/${editorSlug}/editor`]: {
    body: { data: editorBootstrap },
  },
  [`GET /api/contribute/library/${editorSlug}`]: {
    body: { data: editorBootstrap.initialData },
  },
  "GET /api/submissions/my": { body: { data: [] } },
  "GET /api/submissions/my?documentId=example-submission": {
    body: { data: [editorSubmission] },
  },
  "GET /api/submissions/draft/correction": { body: { data: null } },
  "POST /api/submissions": {
    status: 201,
    body: { data: { ...editorSubmission, status: "draft" } },
  },
  "PATCH /api/submissions/example-submission/draft": {
    body: { data: { ...editorSubmission, status: "draft" } },
  },
  "PATCH /api/submissions/example-submission/finalize": {
    body: { data: editorSubmission },
  },
}
export function editorStatusResponses(status: Submission["status"]) {
  const submission = {
    ...editorSubmission,
    status,
    updatedAt: "2026-10-30T10:00:00Z",
    ...(status === "needs_info"
      ? {
          reviewNote:
            "Please link to the library’s current name on its official website.",
        }
      : {}),
  }

  return {
    ...editorResponses,
    "GET /api/submissions/my": { body: { data: [submission] } },
    "GET /api/submissions/my?documentId=example-submission": {
      body: { data: [submission] },
    },
  }
}
