import { isDocumentIdParam } from "@/lib/bridge-params"
import { proxyStaff } from "@/lib/staff-proxy"

const actions = new Set([
  "publish",
  "pause",
  "unpublish",
  "archive",
  "restore",
  "duplicate",
  "review",
  "origins",
])
function validWidgetPath(method: string, path: string[]) {
  const [first, second, third] = path
  let valid = false
  if (!path.length) valid = ["GET", "POST"].includes(method)
  else if (path.length === 1) {
    if (["catalogue", "access-libraries"].includes(first!))
      valid = method === "GET"
    else if (["preview", "selections"].includes(first!))
      valid = method === "POST"
    else if (first === "network") valid = method === "PUT"
    else
      valid = isDocumentIdParam(first ?? "") && ["GET", "PUT"].includes(method)
  } else if (path.length === 2 && first === "selections")
    valid = isDocumentIdParam(second ?? "") && method === "PUT"
  else if (path.length === 3)
    valid =
      isDocumentIdParam(first ?? "") &&
      second === "actions" &&
      actions.has(third!) &&
      method === "POST"

  return valid
}

async function handle(
  req: Request,
  { params }: { params: Promise<{ teamId: string; path?: string[] }> }
) {
  const { teamId, path = [] } = await params
  if (!isDocumentIdParam(teamId))
    return Response.json({ error: "Not found" }, { status: 404 })
  const method = req.method
  const third = path[2]
  const valid = validWidgetPath(method, path)
  if (!valid) return Response.json({ error: "Not found" }, { status: 404 })

  return proxyStaff(req, {
    base: "access",
    path: `teams/${teamId}/widgets${path.length ? `/${path.join("/")}` : ""}`,
    libraryDocumentId: null,
    action: null,
    method: method as "GET" | "POST" | "PUT",
    limiter:
      third === "publish" ? "publish" : method === "GET" ? "read" : "write",
    bodyKeys: [
      "name",
      "type",
      "config",
      "spec",
      "version",
      "selectionId",
      "selectionName",
      "origins",
      "releaseId",
      "documentId",
    ],
    params: {
      q: (v) => v.length <= 80,
      kind: (v) =>
        ["networks", "libraries", "countries", "regions"].includes(v),
      page: (v) => /^\d{1,5}$/.test(v),
      country: isDocumentIdParam,
    },
  })
}

export const GET = handle
export const POST = handle
export const PUT = handle
