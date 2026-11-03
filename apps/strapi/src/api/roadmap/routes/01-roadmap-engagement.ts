// Engagement is public; votes and suggestions are called server-to-server
// by Next.js, authenticated by the bridge secret, with the account in
// X-Ba-User-Id (both checked in the controller).
export default {
  routes: [
    {
      method: "GET",
      path: "/roadmap/engagement",
      handler: "roadmap.engagement",
      config: { auth: false, policies: [] },
    },
    {
      method: "POST",
      path: "/roadmap/votes",
      handler: "roadmap.vote",
      config: { auth: false, policies: [] },
    },
    {
      method: "POST",
      path: "/roadmap/suggestions",
      handler: "roadmap.suggest",
      config: { auth: false, policies: [] },
    },
  ],
}
