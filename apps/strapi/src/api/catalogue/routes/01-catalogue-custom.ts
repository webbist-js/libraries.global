// Loaded before the core router so these paths aren't taken by /catalogues/:id.
export default {
  routes: [
    {
      method: "GET",
      path: "/catalogues/availability",
      handler: "catalogue.availability",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/catalogues/for-library/:documentId",
      handler: "catalogue.forLibrary",
      config: { auth: false },
    },
    // The rest need an API token (or admin role) with the matching permission.
    {
      method: "POST",
      path: "/catalogues/import-uk",
      handler: "catalogue.importUk",
    },
    {
      method: "POST",
      path: "/catalogues/link-library/:documentId",
      handler: "catalogue.linkLibrary",
    },
    {
      method: "POST",
      path: "/catalogues/:documentId/discover",
      handler: "catalogue.discover",
    },
  ],
}
