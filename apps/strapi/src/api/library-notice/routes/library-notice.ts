export default {
  routes: [
    {
      method: "GET",
      path: "/library-notices/for-library/:documentId",
      handler: "library-notice.forLibrary",
      config: { auth: false, policies: [] },
    },
    {
      // Up to 100 libraries' active notices at once, for the search seed.
      method: "GET",
      path: "/library-notices/for-libraries",
      handler: "library-notice.forLibraries",
      config: { auth: false, policies: [] },
    },
  ],
}
