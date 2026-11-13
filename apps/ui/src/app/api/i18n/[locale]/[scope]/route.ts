import { loadCatalogue } from "@/i18n/catalogues"
import manifest from "@/i18n/client-scopes.generated.json"
import { pickMessages } from "@/i18n/pick-messages"
import { routing } from "@/lib/routing"

// Messages for a deferred scope (e.g. a drawer), fetched when it first opens.
// Every locale × scope pair is built once and served as a static file.
export const dynamic = "force-static"
export const dynamicParams = false

const deferred: Record<string, readonly string[]> = manifest.deferred

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    Object.keys(deferred).map((scope) => ({ locale, scope }))
  )
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; scope: string }> }
) {
  const { locale, scope } = await params
  const units = deferred[scope]
  if (!units || !routing.locales.includes(locale as never))
    return new Response(null, { status: 404 })
  const catalogue = await loadCatalogue(
    locale as (typeof routing.locales)[number]
  )

  return Response.json(
    pickMessages(catalogue as Record<string, unknown>, units)
  )
}
