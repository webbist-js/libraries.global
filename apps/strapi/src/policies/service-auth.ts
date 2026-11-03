import { isValidServiceSecret } from "../utils/service-secret"

/** Internal routes never fall back to anonymous or admin authentication. */
export default function serviceAuth(ctx: any) {
  return isValidServiceSecret(ctx.request?.headers?.["x-service-secret"])
}
