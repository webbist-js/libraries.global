import noticesRoutes from "./notices-routes"

const route = (method: string, path: string, action: string) => ({
  method,
  path,
  handler: `staff.${action}`,
  config: { auth: false, policies: [] },
})

export default {
  "content-api": {
    type: "content-api",
    routes: [
      ...noticesRoutes,
      route("GET", "/libraries/:documentId/overview", "overview"),
      {
        method: "GET",
        path: "/libraries/:documentId/drawer",
        handler: "drawer.get",
        config: { auth: false, policies: [] },
      },
      route("GET", "/libraries/:documentId/team", "team"),
      route("PUT", "/libraries/:documentId/members/:affiliationId", "member"),
      route(
        "DELETE",
        "/libraries/:documentId/members/:affiliationId",
        "remove"
      ),
      route("POST", "/libraries/:documentId/leave", "leave"),
      route("POST", "/libraries/:documentId/report", "report"),
    ],
  },
}
