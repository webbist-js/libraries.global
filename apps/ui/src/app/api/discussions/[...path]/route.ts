import { proxyDiscussion } from "@/lib/discussions-proxy"

type Context = { params: Promise<{ path: string[] }> }
async function handle(req: Request, context: Context) {
  return proxyDiscussion(req, (await context.params).path)
}

export { handle as GET, handle as POST, handle as PUT }
