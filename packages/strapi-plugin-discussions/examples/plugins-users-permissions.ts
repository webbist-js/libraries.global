// Copy into an independent Strapi host's config/plugins.ts.
export default () => ({
  discussions: {
    enabled: true,
    config: {
      moderatorRoleIds: [], // Explicit Users & Permissions moderator role IDs.
      targets: {
        "api::article.article": async (
          target: { documentId: string; locale?: string },
          { strapi }: { strapi: any }
        ) => {
          const article = await strapi
            .documents("api::article.article")
            .findOne({
              documentId: target.documentId,
              status: "published",
              ...(target.locale ? { locale: target.locale } : {}),
              fields: ["title", "slug"],
            })
          // Include any additional host audience/access checks here.
          if (!article) return null

          return {
            title: article.title,
            url: `/articles/${encodeURIComponent(article.slug)}`,
          }
        },
      },
    },
  },
})
