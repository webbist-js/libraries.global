import { isDocumentIdParam } from "@/lib/bridge-params"
import { proxyStaff } from "@/lib/staff-proxy"

const KEYS = [
  "intent",
  "locale",
  "staffRole",
  "role",
  "department",
  "note",
  "evidenceUrl",
  "libraryIds",
  "teamId",
  "mandateId",
  "publicDisplay",
  "reason",
  "version",
  "revoke",
] as const
const OPERATIONS: Record<
  string,
  { method: string; prefix: string; action: string }
> = {
  scope: { method: "GET", prefix: "networks", action: "scope" },
  review: { method: "GET", prefix: "network-claims", action: "review" },
  affiliation: { method: "PUT", prefix: "networks", action: "affiliation" },
  claims: { method: "POST", prefix: "networks", action: "claims" },
  withdraw: {
    method: "POST",
    prefix: "network-affiliations",
    action: "revoke",
  },
  retry: { method: "POST", prefix: "network-mandates", action: "retry" },
  reconcile: {
    method: "POST",
    prefix: "network-mandates",
    action: "reconcile",
  },
}
function networkPath(parts: string[], method: string): string | null {
  if (method === "GET" && parts.length === 0) return "networks"
  if (
    method === "GET" &&
    parts.length === 1 &&
    ["me", "staff"].includes(parts[0]!)
  )
    return `networks/${parts[0]}`
  const [id, action] = parts
  if (!id || !isDocumentIdParam(id)) return null
  if (method === "GET" && parts.length === 1) return `networks/${id}`
  if (parts.length !== 2) return null
  const operation = OPERATIONS[action ?? ""]

  return operation?.method === method
    ? `${operation.prefix}/${id}/${operation.action}`
    : null
}
async function handle(
  request: Request,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await context.params,
    upstream = networkPath(path, request.method)
  if (!upstream) return Response.json({ error: "Not found" }, { status: 404 })

  return proxyStaff(request, {
    base: "access",
    path: upstream,
    method: request.method as "GET" | "POST" | "PUT",
    libraryDocumentId: null,
    action: null,
    bodyKeys: KEYS,
    params: {
      q: (v) => v.length <= 120,
      country: (v) => v.length <= 120,
      kind: (v) => v.length <= 50,
      page: (v) => /^\d{1,5}$/.test(v),
      networkId: isDocumentIdParam,
      libraryId: isDocumentIdParam,
    },
    limiter: request.method === "GET" ? "read" : "write",
  })
}

export { handle as GET, handle as POST, handle as PUT }
