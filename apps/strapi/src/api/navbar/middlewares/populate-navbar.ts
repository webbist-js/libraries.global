import { applyDefaultQuery, navbarDefaultQuery } from "../../../defaultQueries"

export default () => {
  return async (ctx, next) => {
    ctx.query = applyDefaultQuery(ctx.query, navbarDefaultQuery)

    await next()
  }
}
