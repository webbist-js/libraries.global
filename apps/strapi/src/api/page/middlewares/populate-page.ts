import { applyDefaultQuery, pageDefaultQuery } from "../../../defaultQueries"

export default () => {
  return async (ctx, next) => {
    ctx.query = applyDefaultQuery(ctx.query, pageDefaultQuery)

    await next()
  }
}
