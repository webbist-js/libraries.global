import { readSupporters } from "../../../utils/supporters"

export default {
  async find(ctx: any) {
    ctx.set("Cache-Control", "no-store")
    ctx.send({ data: await readSupporters(strapi, ctx.query) })
  },
}
