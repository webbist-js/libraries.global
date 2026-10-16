export default {
  // CMS discovery aggregates lean published rows; fail explicitly beyond this
  // bound so operators can choose a search adapter before counts become partial.
  articleBrowseMaxEntries: 10_000,
  rest: {
    defaultLimit: 25,
    maxLimit: 100,
    withCount: true,
    // Reject unknown query keys on the core REST controllers (E2).
    strictParams: true,
  },
  documents: {
    // Make the Document Service throw on invalid `status`, `locale` and
    // pagination values instead of silently ignoring them. Note that a
    // `pagination: {}` object is still accepted and *dropped* by Strapi
    // 5.55.1 (`ALLOWED_DOCUMENT_ROOT_PARAM_KEYS`): use flat `start`/`limit`
    // (or `page`/`pageSize`) with a stable `sort` in every findMany.
    strictParams: true,
  },
}
