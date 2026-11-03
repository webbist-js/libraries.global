/** Better Auth in Strapi owns the current verified account address. */
export async function verifiedEmailMap(
  strapi: any,
  ids: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const valid = [...new Set(ids)].filter((id) => /^[1-9]\d{0,9}$/.test(id))
  for (let offset = 0; offset < valid.length; offset += 100) {
    const rows = await strapi.db.query("plugin::better-auth.user").findMany({
      where: {
        id: { $in: valid.slice(offset, offset + 100).map(Number) },
        emailVerified: true,
      },
      select: ["id", "email"],
    })
    for (const row of rows)
      if (
        valid.includes(String(row.id)) &&
        typeof row.email === "string" &&
        !row.email.toLowerCase().endsWith(".invalid")
      )
        result.set(String(row.id), row.email)
  }

  return result
}
