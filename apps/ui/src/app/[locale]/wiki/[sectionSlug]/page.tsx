import { permanentRedirect } from "next/navigation"

/** The wiki is deprecated — sections now live in the docs taxonomy. */
export default async function WikiSectionPage({
  params,
}: {
  params: Promise<{ locale: string; sectionSlug: string }>
}) {
  const { locale } = await params
  permanentRedirect(`/${locale}/docs`)
}
