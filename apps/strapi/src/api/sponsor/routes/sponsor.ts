/**
 * Sponsor records are admin-only: no core CRUD router. The one public route
 * returns current, consented acknowledgements for the /sponsor page.
 */
export default {
  routes: [
    {
      method: "GET",
      path: "/sponsors/acknowledgements",
      handler: "sponsor.acknowledgements",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
