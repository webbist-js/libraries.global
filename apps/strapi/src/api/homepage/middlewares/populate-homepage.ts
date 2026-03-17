import {
  applyDefaultQuery,
  homepageDefaultQuery,
} from "../../../defaultQueries"

export default () => {
  return async (ctx, next) => {
    ctx.query = applyDefaultQuery(ctx.query, homepageDefaultQuery)

    await next()
  }
}
