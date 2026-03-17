import { applyDefaultQuery, footerDefaultQuery } from "../../../defaultQueries"

export default () => {
  return async (ctx, next) => {
    ctx.query = applyDefaultQuery(ctx.query, footerDefaultQuery)

    await next()
  }
}
