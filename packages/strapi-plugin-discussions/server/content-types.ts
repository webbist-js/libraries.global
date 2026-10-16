const string = { type: "string" }
const required = { type: "string", required: true }
const privateString = { type: "string", private: true }
const integer = { type: "integer", default: 0, required: true }
const json = { type: "json" }
const state = {
  type: "enumeration",
  enum: ["pending", "visible", "rejected", "removed"],
  default: "pending",
  required: true,
}
const record = {
  recordType: {
    type: "enumeration",
    enum: ["thread", "reply"],
    required: true,
  },
  recordId: required,
  threadId: required,
}
const author = {
  authorKey: { ...privateString, required: true },
  authorName: required,
  authorProfile: json,
}
function schema(
  name: string,
  attributes: Record<string, any>,
  indexes: any[] = []
) {
  return {
    schema: {
      kind: "collectionType",
      collectionName: `discussions_${name.replaceAll("-", "_")}s`,
      info: {
        singularName: name,
        pluralName: `${name}s`,
        displayName: `Discussion ${name}`,
      },
      options: { draftAndPublish: false },
      pluginOptions: {
        "content-manager": { visible: false },
        "content-type-builder": { visible: false },
      },
      // Strapi adds column names to attribute objects; each field must own its object.
      attributes: Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [
          key,
          {
            ...structuredClone(value),
            ...(value.required
              ? { column: { ...value.column, notNullable: true } }
              : {}),
          },
        ])
      ),
      // Attribute `unique` is validation metadata in Strapi; declare physical constraints explicitly.
      indexes: [
        ...indexes,
        {
          name: `discussions_${name.replaceAll("-", "_")}_document_unique`,
          columns: ["document_id"],
          type: "unique",
        },
        ...Object.entries(attributes)
          .filter(([, value]) => value.unique)
          .map(([key]) => ({
            name: `discussions_${name.replaceAll("-", "_")}_${key.replaceAll(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)}_unique`,
            columns: [
              key.replaceAll(/[A-Z]/g, (char) => `_${char.toLowerCase()}`),
            ],
            type: "unique",
          })),
      ],
    },
  }
}
const index = (name: string, columns: string[]) => ({
  name: `discussions_${name}`,
  columns,
})

export default {
  subject: schema("subject", {
    name: required,
    slug: { ...required, unique: true },
    description: { type: "text" },
    languages: json,
    visibility: {
      type: "enumeration",
      enum: ["public", "members", "private"],
      default: "public",
      required: true,
    },
    createPolicy: {
      type: "enumeration",
      enum: ["members", "moderators"],
      default: "members",
      required: true,
    },
    version: integer,
  }),
  thread: schema(
    "thread",
    {
      title: required,
      body: { type: "text", default: "" },
      subjectId: required,
      language: required,
      ...author,
      target: { ...json, private: true },
      targetKey: { ...privateString, unique: true },
      state,
      version: integer,
      locked: { type: "boolean", default: false },
      pinned: { type: "boolean", default: false },
      activityAt: { type: "datetime" },
    },
    [
      index("thread_subject_state_activity", [
        "subject_id",
        "state",
        "activity_at",
      ]),
    ]
  ),
  reply: schema(
    "reply",
    {
      threadId: required,
      parentId: string,
      language: required,
      body: { type: "text", default: "" },
      ...author,
      state,
      version: integer,
    },
    [index("reply_thread_state", ["thread_id", "state"])]
  ),
  revision: schema(
    "revision",
    {
      ...record,
      ...author,
      body: { type: "text", required: true, private: true },
      title: string,
      baseVersion: integer,
      state: {
        type: "enumeration",
        enum: ["pending", "approved", "rejected"],
        default: "pending",
        required: true,
      },
      reviewerKey: privateString,
      reviewNote: { type: "text", private: true },
      decidedAt: { type: "datetime" },
    },
    [
      index("revision_state", ["state", "created_at"]),
      index("revision_record", ["record_type", "record_id"]),
    ]
  ),
  report: schema(
    "report",
    {
      ...record,
      reporterKey: { ...privateString, required: true },
      reason: { type: "text", required: true, private: true },
      dedupeKey: { ...required, unique: true, private: true },
      recordVersion: integer,
      snapshotBody: { type: "text", private: true },
      snapshotTitle: privateString,
      state: {
        type: "enumeration",
        enum: ["open", "dismissed", "actioned"],
        default: "open",
        required: true,
      },
      reviewerKey: privateString,
      reviewNote: { type: "text", private: true },
      version: integer,
    },
    [index("report_state", ["state", "created_at"])]
  ),
  subscription: schema(
    "subscription",
    {
      threadId: required,
      actorKey: { ...privateString, required: true },
      dedupeKey: { ...required, unique: true, private: true },
    },
    [index("subscription_thread", ["thread_id"])]
  ),
  "audit-event": schema(
    "audit-event",
    {
      ...record,
      actorKey: { ...privateString, required: true },
      action: required,
      detail: { ...json, private: true },
    },
    [index("audit_record", ["record_type", "record_id", "created_at"])]
  ),
  "erased-actor": schema("erased-actor", {
    actorHash: { ...required, unique: true, private: true },
  }),
  "rate-window": schema("rate-window", {
    actorKey: { ...required, unique: true, private: true },
    windowStartedAt: { type: "datetime", required: true },
    actions: integer,
  }),
  outbox: schema(
    "outbox",
    {
      event: { ...json, private: true, required: true },
      dedupeKey: { ...required, unique: true, private: true },
      actorKey: privateString,
      subscriptionCursor: integer,
      hookDelivered: { type: "boolean", default: false },
      state: {
        type: "enumeration",
        enum: ["pending", "dispatching", "done"],
        default: "pending",
        required: true,
      },
      attempts: integer,
      claimedAt: { type: "datetime" },
      lastError: { type: "text", private: true },
    },
    [index("outbox_state", ["state", "created_at"])]
  ),
}
