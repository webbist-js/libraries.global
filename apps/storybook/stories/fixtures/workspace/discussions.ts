import type {
  DiscussionContextFeed,
  DiscussionContextLink,
  DiscussionImage,
  DiscussionRecord,
  DiscussionReport,
  DiscussionRestriction,
  DiscussionRevision,
  Subject,
} from "@/components/discussions/api"

import { readerSession } from "../../../.storybook/FixtureSession"
import { openingMessage, conversationReplies } from "../discussions"

export const subject: Subject = {
  id: openingMessage.subjectId,
  name: "Library life",
  slug: "library-life",
  description: "Share practical ideas for welcoming library services.",
  visibility: "public",
  createPolicy: "members",
  languages: ["en", "cy"],
  threadCount: 3,
}
export const thread: DiscussionRecord = {
  ...openingMessage,
  excerpt: openingMessage.body,
  subject,
  participants: [openingMessage.author, conversationReplies[0]!.author].filter(
    (author): author is NonNullable<typeof author> => author !== null
  ),
  participantCount: 2,
  target: { title: "Northbridge Library", url: "/libraries/northbridge" },
}
export const context: DiscussionContextFeed = {
  target: {
    uid: "api::library.library",
    documentId: "example-library",
    locale: "en",
  },
  projection: { title: "Northbridge Library", url: "/libraries/northbridge" },
  enabled: true,
  version: 1,
  canManage: false,
  canPropose: true,
  links: [],
}
export const revision: DiscussionRevision = {
  id: "example-revision",
  recordType: "thread",
  recordId: thread.id,
  threadId: thread.id,
  title: thread.title,
  body: thread.body,
  language: "en",
  baseVersion: 1,
  currentVersion: 1,
  subjectId: subject.id,
  author: thread.author,
  createdAt: "2026-01-15T10:00:00Z",
  canReview: true,
  canSanction: true,
  attachments: [],
}
export const report: DiscussionReport = {
  id: "example-report",
  recordType: "thread",
  recordId: thread.id,
  threadId: thread.id,
  language: "en",
  reason: "The event venue information appears to be out of date.",
  version: 1,
  currentVersion: 2,
  recordVersion: 1,
  currentState: "visible",
  reportedTitle: "Community reading group",
  reportedBody: "The group meets at the old library building.",
  currentTitle: "Community reading group",
  currentBody:
    "The group now meets at Northbridge Library. Please check the current venue before travelling.",
  reportedAttachments: [],
  currentAttachments: [],
}
export const restriction: DiscussionRestriction = {
  id: "example-restriction",
  version: 1,
  mode: "mute",
  subjectId: subject.id,
  subjectName: subject.name,
  reason: "Repeated off-topic messages after a moderator reminder.",
  contributorFeedback:
    "Please keep replies relevant to the library service being discussed.",
  expiresAt: "2026-11-30T12:00:00Z",
  canAppeal: true,
  canLift: true,
  author: { name: "Example contributor", background: "amber" },
  active: true,
}
export const image: DiscussionImage = {
  id: "example-library.webp",
  altText: "Illustration of a community library with a welcoming entrance",
  caption: "A synthetic library illustration for the pattern library.",
  width: 800,
  height: 500,
  mime: "image/webp",
}
export const contextLink: DiscussionContextLink = {
  id: "example-context-link",
  target: context.target,
  threadId: thread.id,
  title: context.projection.title,
  url: context.projection.url,
  featured: false,
  state: "visible",
  version: 1,
  canManage: true,
  canReview: true,
  public: true,
  targetPublic: true,
}
export const moderatedThread: DiscussionRecord = {
  ...thread,
  contexts: [contextLink],
  viewer: {
    canReply: true,
    canReact: true,
    canModerate: true,
    canSanction: true,
  },
}
export const discussionResponses = {
  "GET /api/discussions/threads/example-mobile-library": { body: thread },
  "GET /api/discussions/threads/example-mobile-library/replies": {
    body: {
      data: conversationReplies,
      nextOffset: null,
      total: conversationReplies.length,
    },
  },
  "GET /api/discussions/moderation/threads/example-mobile-library/audit": {
    body: {
      data: [
        {
          id: "example-audit",
          recordType: "thread",
          recordId: thread.id,
          action: "approved",
          createdAt: "2026-01-15T12:00:00Z",
          actor: { name: "Example moderator" },
        },
      ],
    },
  },
  "PUT /api/discussions/moderation/revisions/example-revision": {
    body: { ok: true },
  },
  "PUT /api/discussions/context-links/example-context-link": {
    body: { ok: true },
  },
  "POST /api/discussions/moderation/records/thread/example-mobile-library/sanctions":
    { body: { ok: true } },
  "POST /api/discussions/attachments": { body: image },

  "GET /api/discussions/session": {
    body: {
      signedIn: true,
      canModerate: true,
      viewerId: readerSession.user.id,
    },
  },
  "GET /api/discussions/subjects": {
    body: { data: [subject], total: 1, nextOffset: null },
  },
  "GET /api/discussions/threads": {
    body: {
      data: [
        thread,
        {
          ...thread,
          id: "example-accessible-clubs",
          title: "Making reading groups more accessible",
          replyCount: 0,
          excerpt:
            "What has helped your community welcome readers with different access needs?",
        },
      ],
      total: 2,
      nextOffset: null,
    },
  },
  "GET /api/discussions/context": { body: context },
  "GET /api/discussions/contexts": {
    body: {
      data: [{ target: context.target, title: context.projection.title }],
    },
  },
  "GET /api/discussions/my/records": {
    body: { data: [], total: 0, nextOffset: null },
  },
  "GET /api/discussions/my/status": {
    body: { data: [], total: 0, nextOffset: null },
  },
  "GET /api/relations/locales": {
    body: {
      data: [
        { code: "en", name: "English" },
        { code: "cy", name: "Welsh" },
      ],
    },
  },
  "GET /api/discussions/moderation/revisions": {
    body: { data: [revision], total: 1, nextOffset: null },
  },
  "GET /api/discussions/moderation/reports": {
    body: { data: [report], total: 1, nextOffset: null },
  },
  "GET /api/discussions/moderation/sanctions": {
    body: { data: [restriction], total: 1, nextOffset: null },
  },
  "PUT /api/discussions/moderation/reports/example-report": {
    body: { ok: true },
  },
  "PUT /api/discussions/moderation/sanctions/example-restriction": {
    body: { ok: true },
  },
  "PUT /api/discussions/my/sanctions/example-restriction/appeal": {
    body: { ok: true },
  },
}
export { readerSession }
