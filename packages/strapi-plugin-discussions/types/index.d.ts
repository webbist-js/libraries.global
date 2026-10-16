export type Action =
  | "read"
  | "createThread"
  | "reply"
  | "editOwn"
  | "report"
  | "subscribe"
  | "moderate"
export type Actor = {
  key: string
  name: string
  profile?: { slug?: string; url?: string }
  capabilities?: Action[]
  admin?: boolean
}
export type PublicAuthor = { name: string; slug?: string; url?: string }
export type Target = { uid: string; documentId: string; locale?: string }
export type TargetProjection = { title: string; url: string }
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
export type DiscussionConfig = {
  publicAuthor?: (
    key: string,
    context: { strapi: any }
  ) => Promise<PublicAuthor | null>
  identity?: (ctx: any, context: { strapi: any }) => Promise<Actor | null>
  authorize?: (
    context: Context & {
      action: Action
      subject: any
      thread?: any
      recordLanguage?: string
    }
  ) => Promise<boolean>
  targets: Record<string, TargetResolver>
  moderatorRoleIds: number[]
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
