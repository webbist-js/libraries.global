/** Better Auth is the authority for the current, verified account address. */
export async function verifiedEmailMap(
  strapi: any,
  ids: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret || !ids.length) return result
  const base =
    process.env.APP_INTERNAL_URL ||
    process.env.APP_PUBLIC_URL ||
    "https://libraries.global"
  try {
    const unique = [...new Set(ids)]
    for (let i = 0; i < unique.length; i += 100) {
      const response = await fetch(
        `${base.replace(/\/$/, "")}/api/internal/notifications/recipients`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Service-Secret": secret,
          },
          body: JSON.stringify({ ids: unique.slice(i, i + 100) }),
          signal: AbortSignal.timeout(10000),
        }
      )
      if (!response.ok)
        throw new Error(`Recipient lookup returned ${response.status}`)
      const { data } = (await response.json()) as {
        data: { id: string; email: string }[]
      }
      for (const row of data)
        if (
          unique.includes(row.id) &&
          typeof row.email === "string" &&
          !row.email.toLowerCase().endsWith(".invalid")
        )
          result.set(row.id, row.email)
    }
  } catch {
    strapi.log.warn("[email] Verified recipient lookup unavailable")
    throw new Error("Verified recipient lookup unavailable")
  }

  return result
}
