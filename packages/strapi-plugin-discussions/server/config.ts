import type { DiscussionConfig } from "./contracts"

export const defaults: DiscussionConfig = {
  targets: {},
  moderatorRoleIds: [],
  requireConfirmed: true,
  allowSelfReview: false,
  maxBodyLength: 20000,
  maxPageSize: 50,
  maxWritesPerHour: 120,
  notificationBatchSize: 100,
}
export default {
  default: defaults,
  validator(config: DiscussionConfig) {
    for (const [key, max] of [
      ["maxBodyLength", 100000],
      ["maxPageSize", 100],
      ["maxWritesPerHour", 10000],
      ["notificationBatchSize", 1000],
    ] as const) {
      if (
        !Number.isInteger(config[key]) ||
        config[key] < 1 ||
        config[key] > max
      )
        throw new Error(`discussions: invalid ${key}`)
    }
    for (const key of ["requireConfirmed", "allowSelfReview"] as const)
      if (typeof config[key] !== "boolean")
        throw new Error(`discussions: ${key} must be a boolean`)
    if (
      !config.targets ||
      typeof config.targets !== "object" ||
      Array.isArray(config.targets)
    )
      throw new Error("discussions: targets must be a resolver map")
    for (const [uid, resolver] of Object.entries(config.targets)) {
      if (
        !/^(api|plugin)::[a-z0-9-]+\.[a-z0-9-]+$/.test(uid) ||
        typeof resolver !== "function"
      )
        throw new Error("discussions: invalid target resolver")
    }
    for (const hook of [
      "identity",
      "publicAuthor",
      "authorize",
      "notify",
      "notificationActor",
      "onEvent",
    ] as const)
      if (config[hook] !== undefined && typeof config[hook] !== "function")
        throw new Error(`discussions: ${hook} must be a function`)
    if (
      !Array.isArray(config.moderatorRoleIds) ||
      config.moderatorRoleIds.some(
        (value) => !Number.isSafeInteger(value) || value < 1
      )
    )
      throw new Error("discussions: invalid moderator role ids")
  },
}
