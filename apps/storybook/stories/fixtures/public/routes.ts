import type { IncompleteRecord } from "@/app/[locale]/(dashboard)/contribute/_components/hub/RecordsThatNeedYou"
import type { HubSubmission } from "@/app/[locale]/(dashboard)/contribute/_components/hub/YourSubmissionsList"
import type { EditableArticle } from "@/app/[locale]/(dashboard)/contribute/knowledge/_components/article-catalogue"
import type { Submission } from "@/hooks/useSubmissions"
import type { SupportersResponse } from "@repo/shared-data"

import { existingArticle } from "./editor"

export const supporterDirectory: SupportersResponse = {
  entries: [
    {
      username: "maya",
      displayName: "Maya S.",
      initials: "MS",
      city: "Northbridge",
      country: "GB",
      since: "2025-06-01",
    },
    {
      username: "leo",
      displayName: "Leo R.",
      initials: "LR",
      city: null,
      country: "FR",
      since: "2026-01-02",
    },
  ],
  newThisMonth: [],
  total: 12,
  listed: 2,
  unlisted: 10,
  countries: ["GB", "FR"],
  matched: 2,
  page: 1,
  pageSize: 20,
  costs: {
    month: "2026-01-01",
    currency: "GBP",
    runningCosts: 180,
    supportIncome: 135,
    breakdown: null,
  },
  title: null,
  lead: null,
}
export const incompleteRecords: IncompleteRecord[] = [
  {
    documentId: "example-library",
    slug: "northbridge-library",
    name: "Northbridge Library",
    place: "Northbridge",
    percent: 72,
    missing: ["Opening hours", "Photo"],
  },
  {
    documentId: "example-riverside",
    slug: "riverside-library",
    name: "Riverside Library",
    place: "Riverside",
    percent: 86,
    missing: ["Photo"],
  },
]
export const hubSubmissions: HubSubmission[] = [
  {
    documentId: "example-correction",
    submissionType: "correction",
    status: "pending",
    targetName: "Northbridge Library",
    createdAt: "2026-01-20T12:00:00Z",
    drive: null,
  },
  {
    documentId: "example-approved",
    submissionType: "blog_submission",
    status: "approved",
    targetName: "Welcoming a new reader",
    createdAt: "2026-01-18T12:00:00Z",
    drive: null,
  },
]
export const editableArticles: EditableArticle[] = [
  {
    kind: "knowledge",
    documentId: existingArticle.documentId,
    slug: existingArticle.slug,
    title: existingArticle.title,
    sections: existingArticle.sections,
    publishedAt: existingArticle.publishedAt ?? null,
    updatedAt: existingArticle.updatedAt ?? null,
    locale: "en",
    canEdit: true,
    contributorCount: 3,
    translations: [
      {
        locale: "en",
        slug: existingArticle.slug,
        title: existingArticle.title,
      },
    ],
  },
]
export const mySubmissions: Submission[] = [
  {
    documentId: "example-draft",
    submissionType: "wiki_edit",
    status: "draft",
    targetEntityType: "wiki_article",
    targetSlug: existingArticle.slug,
    targetLabel: existingArticle.title,
    createdAt: "2026-01-18T12:00:00Z",
    updatedAt: "2026-01-20T12:00:00Z",
    draftData: { proposedTitle: existingArticle.title, locale: "en" },
  },
  {
    documentId: "example-needs-info",
    submissionType: "correction",
    status: "needs_info",
    targetEntityType: "library",
    targetSlug: "northbridge-library",
    targetLabel: "Northbridge Library",
    reviewNote: "Please add a link to the official opening hours.",
    createdAt: "2026-01-18T12:00:00Z",
    updatedAt: "2026-01-20T12:00:00Z",
  },
]
