export default {
  routes: [
    {
      method: "GET",
      path: "/legal-documents/nav",
      handler: "legal-document.nav",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/legal-documents/detail/:slug",
      handler: "legal-document.detail",
      config: { auth: false },
    },
  ],
}
