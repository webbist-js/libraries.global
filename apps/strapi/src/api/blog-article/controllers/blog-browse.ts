import { browseArticles } from "../../../utils/article-browse"

export default {
  async browse(ctx) {
    ctx.body = await browseArticles(strapi, "blog", ctx.query ?? {})
  },
}
