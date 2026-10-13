/**
 * GET /libraries/by-slug/:slug — one library by slug with the **detail**
 * shape (`LIBRARY_SHAPES.detail`: the Mobile timetable, home base and
 * vehicles, social links, long text), for the library page and the Index
 * editor. The core list route keeps the light list shape, so a by-slug
 * read must not go through it.
 */
export default {
  routes: [
    {
      method: "GET",
      path: "/libraries/by-slug/:slug",
      handler: "library.findBySlug",
      config: {
        // Use the core list permission to load the reader's relation
        // permissions; disabling auth makes sanitization drop them.
        auth: { scope: ["api::library.library.find"] },
        middlewares: [
          { name: "api::library.library-populate", config: { view: "detail" } },
        ],
      },
    },
  ],
}
