// Operator CLI: uses the private service bridge; never prints credentials.
try {
  process.loadEnvFile(".env")
} catch {
  /* Deployments can provide env directly. */
}
async function main() {
  const [action = "status", baUserId] = process.argv.slice(2)
  if (
    ![
      "status",
      "previewReport",
      "digest",
      "report",
      "follows",
      "announcements",
      "deliver",
    ].includes(action)
  )
    throw new Error(
      "Usage: notifications:check status|previewReport <user-id>|digest|report|follows|announcements|deliver"
    )
  if (!process.env.STRAPI_BRIDGE_SECRET)
    throw new Error("STRAPI_BRIDGE_SECRET is required")
  const response = await fetch(
    `${process.env.STRAPI_URL || "http://127.0.0.1:1337"}/api/notifications/operations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": process.env.STRAPI_BRIDGE_SECRET,
      },
      body: JSON.stringify({ action, baUserId }),
      signal: AbortSignal.timeout(90000),
    }
  )
  if (!response.ok)
    throw new Error(`Notification operation failed (${response.status})`)
  console.log(JSON.stringify(await response.json(), null, 2))
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Operation failed")
  process.exitCode = 1
})
