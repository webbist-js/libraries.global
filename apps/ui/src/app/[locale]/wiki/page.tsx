import { permanentRedirect } from "next/navigation"

/** The wiki is deprecated — /docs is the documentation hub. */
export default async function WikiPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  permanentRedirect(`/${locale}/docs`)
}
