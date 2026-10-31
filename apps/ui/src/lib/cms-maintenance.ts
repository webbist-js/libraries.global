import "server-only"

export async function cmsMaintenance(
  action: "maintenance" | "maintenanceStatus"
) {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  const base = process.env.STRAPI_URL
  if (!secret || !base) return { ok: false }
  try {
    const response = await fetch(
      `${base.replace(/\/$/, "")}/api/notifications/operations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": secret,
        },
        body: JSON.stringify({ action }),
        cache: "no-store",
        signal: AbortSignal.timeout(action === "maintenance" ? 60_000 : 5000),
      }
    )
    if (!response.ok) return { ok: false }
    const result = await response.json()

    return { ok: result.ok === true }
  } catch {
    return { ok: false }
  }
}
