import type { DiscussionConfig } from "./contracts"

export const defaults: DiscussionConfig = {
  targets: {},
  moderatorRoleIds: [],
  sanctionRoleIds: [],
  maxPendingPerActor: 20,
  maxScanEntries: 10000,
  profanityTerms: {},
  maxImageBytes: 4 * 1024 * 1024,
  maxImagesPerRevision: 3,
  maxImagesPerActor: 30,
  stagingRetentionHours: 168,
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
      ["maxImageBytes", 8 * 1024 * 1024],
      ["maxImagesPerRevision", 5],
      ["maxImagesPerActor", 100],
      ["stagingRetentionHours", 720],
      ["maxPendingPerActor", 100],
      ["maxScanEntries", 100000],
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
    if (
      config.mediaStore &&
      ["put", "get", "delete"].some(
        (key) => typeof (config.mediaStore as any)[key] !== "function"
      )
    )
      throw new Error("discussions: invalid private media store")
    if (
      config.mediaStore?.prune !== undefined &&
      typeof config.mediaStore.prune !== "function"
    )
      throw new Error("discussions: invalid private media cleanup")
    if (
      config.mediaDirectory !== undefined &&
      (typeof config.mediaDirectory !== "string" || !config.mediaDirectory)
    )
      throw new Error("discussions: invalid private media directory")
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
      !config.profanityTerms ||
      typeof config.profanityTerms !== "object" ||
      Array.isArray(config.profanityTerms) ||
      Object.entries(config.profanityTerms).some(
        ([locale, terms]) =>
          !/^[a-zA-Z-]{2,35}$/.test(locale) ||
          !Array.isArray(terms) ||
          terms.length > 128 ||
          terms.some(
            (term) =>
              typeof term !== "string" || term.length < 2 || term.length > 64
          )
      )
    )
      throw new Error("discussions: invalid profanity terms")
    if (
      !Array.isArray(config.sanctionRoleIds) ||
      config.sanctionRoleIds.some(
        (value) => !Number.isSafeInteger(value) || value < 1
      )
    )
      throw new Error("discussions: invalid sanction role ids")
    if (
      !Array.isArray(config.moderatorRoleIds) ||
      config.moderatorRoleIds.some(
        (value) => !Number.isSafeInteger(value) || value < 1
      )
    )
      throw new Error("discussions: invalid moderator role ids")
  },
}
