export type Action =
  | "read"
  | "createThread"
  | "reply"
  | "editOwn"
  | "report"
  | "subscribe"
  | "moderate"
  | "react"
  | "upload"
  | "sanction"
export type Actor = {
  key: string
  name: string
  profile?: { slug?: string; url?: string }
  capabilities?: Action[]
  admin?: boolean
}
export type PublicAuthorBadge =
  | "editor"
  | "moderator"
  | "editorial_board"
  | "suggested_this"
export type PublicAuthor = {
  name: string
  slug?: string
  url?: string
  avatar?: { url: string; alternativeText?: string }
  background?: "violet" | "coral" | "mint" | "amber" | "blue" | "rose"
  badges?: PublicAuthorBadge[]
}
export type Target = { uid: string; documentId: string; locale?: string }
export type TargetProjection = {
  active?: boolean
  title: string
  url: string
  links?: { label: string; url: string }[]
}
export type Context = { strapi: any; actor: Actor | null }
export type TargetResolver = (
  target: Target,
  context: Context
) => Promise<TargetProjection | null>
export type CommittedEvent = {
  id: string
  type: "visible" | "removed" | "anonymized"
  recordType: "thread" | "reply"
  recordId: string
  threadId: string
  version: number
}
export type Notification = {
  idempotencyKey: string
  actorKey: string
  event: CommittedEvent
}
export type MediaStore = {
  put: (key: string, bytes: Uint8Array) => Promise<void>
  get: (key: string) => Promise<Uint8Array | null>
  delete: (key: string) => Promise<void>
  prune?: (
    retained: Set<string>,
    olderThan: Date,
    limit: number
  ) => Promise<void>
}
export type DiscussionConfig = {
  contextKinds?: Record<
    string,
    { uid: string; label: string; defaultEnabled?: boolean }
  >
  authorizeContext?: (
    context: Context & { target: Target }
  ) => Promise<"manage" | "propose" | false>
  mediaStore?: MediaStore
  mediaDirectory?: string
  maxImageBytes: number
  maxImagesPerRevision: number
  maxImagesPerActor: number
  stagingRetentionHours: number
  publicAuthor?: (
    key: string,
    context: { strapi: any; target?: Target }
  ) => Promise<PublicAuthor | null>
  identity?: (ctx: any, context: { strapi: any }) => Promise<Actor | null>
  authorize?: (
    context: Context & {
      action: Action
      subject: any
      thread?: any
      recordLanguage?: string
      sanctionScope?: "subject" | "all"
    }
  ) => Promise<boolean>
  targets: Record<string, TargetResolver>
  moderatorRoleIds: number[]
  sanctionRoleIds: number[]
  maxPendingPerActor: number
  maxScanEntries: number
  profanityTerms: Record<string, string[]>
  requireConfirmed: boolean
  allowSelfReview: boolean
  maxBodyLength: number
  maxPageSize: number
  maxWritesPerHour: number
  notificationBatchSize: number
  notify?: (notification: Notification) => Promise<void>
  notificationActor?: (
    key: string,
    context: { strapi: any }
  ) => Promise<Actor | null>
  onEvent?: (event: CommittedEvent) => Promise<void>
}

/** Portable HTTP projections. Private identity keys and storage URLs never appear here. */
export type DiscussionState = "pending" | "visible" | "rejected" | "removed"
export type DiscussionImage = {
  id: string
  altText: string
  caption?: string
  width: number
  height: number
  mime: "image/webp"
}
export type DiscussionSubject = {
  id: string
  name: string
  slug: string
  description?: string
  languages?: string[]
  visibility: "public" | "members" | "private"
  createPolicy: "members" | "moderators"
  threadCount?: number
  version?: number
}
export type DiscussionQuote = {
  kind: "thread" | "reply"
  id: string
  version: number
  available: boolean
  currentVersion?: number
  excerpt?: string
  author?: PublicAuthor | null
}
export type DiscussionRecord = {
  contexts?: DiscussionContextLink[]
  id: string
  subjectId: string
  body: string
  language: string
  state: DiscussionState
  version: number
  author: PublicAuthor | null
  title?: string
  threadId?: string
  parentId?: string | null
  parent?: { id: string; author: PublicAuthor | null; excerpt: string } | null
  locked?: boolean
  pinned?: boolean
  createdAt?: string
  activityAt?: string
  excerpt?: string
  replyCount?: number
  participants?: PublicAuthor[]
  participantCount?: number
  lastReplyAt?: string
  subscribed?: boolean
  reactions: { like: number; love: number }
  myReaction: "like" | "love" | null
  attachments: DiscussionImage[]
  quote?: DiscussionQuote | null
  viewer?: {
    canReply: boolean
    canReact: boolean
    canModerate: boolean
    canSanction: boolean
  }
  target?: TargetProjection
  moderationFeedback?: string | null
  subject?: DiscussionSubject
  pendingRevision?: {
    id: string
    body: string
    title?: string
    baseVersion: number
    attachments: DiscussionImage[]
  }
  latestRevision?: {
    id: string
    state: "pending" | "approved" | "rejected" | "changes_requested"
    body: string
    title?: string
    baseVersion: number
    feedback?: string | null
    attachments: DiscussionImage[]
  } | null
}

export type DiscussionContextLink = TargetProjection & {
  public?: boolean
  targetPublic?: boolean
  feedback?: string | null
  id: string
  target: Target
  threadId: string
  featured: boolean
  state: "visible" | "pending" | "rejected" | "removed"
  version: number
  canManage?: boolean
  canReview?: boolean
  thread?: { title: string; language: string }
}
export type DiscussionContextFeed = {
  target: Target
  projection: TargetProjection
  enabled: boolean
  version: number
  canManage: boolean
  canPropose: boolean
  links: DiscussionContextLink[]
}
export type DiscussionRevision = {
  id: string
  recordType: "thread" | "reply"
  recordId: string
  threadId: string
  title?: string
  body: string
  language?: string
  previousBody?: string
  previousTitle?: string
  baseVersion: number
  currentVersion: number
  threadTitle?: string
  threadVersion?: number
  subjectId?: string
  createdAt?: string
  recordState?: DiscussionState
  parentId?: string | null
  parentAuthor?: PublicAuthor | null
  canReview?: boolean
  canSanction?: boolean
  isOwn?: boolean
  quote?: DiscussionQuote | null
  author?: PublicAuthor | null
  state?: string
  attachments: DiscussionImage[]
  contentFlags?: { language: string; covered: boolean; terms: string[] }
}
export type DiscussionAuditEvent = {
  id: string
  recordType: "thread" | "reply"
  recordId: string
  action: string
  createdAt?: string
  actor?: PublicAuthor | null
}
export type DiscussionReport = {
  id: string
  recordType: "thread" | "reply"
  recordId: string
  threadId: string
  language?: string
  reason: string
  version: number
  currentVersion: number
  recordVersion: number
  currentState: DiscussionState
  reportedTitle?: string | null
  reportedBody: string
  currentTitle?: string
  currentBody: string
  reportedAttachments: DiscussionImage[]
  currentAttachments: DiscussionImage[]
}
export type DiscussionRestriction = {
  id: string
  version: number
  mode: "mute" | "ban"
  subjectId: string | null
  reason: string
  expiresAt?: string | null
  canAppeal?: boolean
  appeal?: string | null
  canLift?: boolean
  author?: PublicAuthor | null
  subjectName?: string
  contributorFeedback?: string
  active?: boolean
  recordType?: "thread" | "reply"
  recordId?: string
  threadId?: string
  language?: string
  liftReason?: string | null
}
export type DiscussionList<T> = {
  data: T[]
  nextOffset?: number | null
  total?: number
}
