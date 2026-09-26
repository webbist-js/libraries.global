import { permanentRedirect } from "next/navigation"

/** The wiki is deprecated — search now lives at /docs/search. */
export default async function WikiSearchRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const [{ locale }, { q }] = await Promise.all([params, searchParams])
  const query = q ? `?q=${encodeURIComponent(q)}` : ""
  permanentRedirect(`/${locale}/docs/search${query}`)
}
