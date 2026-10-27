import { PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { NetworkDirectory } from "@/components/networks/NetworkDirectory"
import { publicNetworkList } from "@/lib/networks/server"
import { buildMetadata } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return buildMetadata({
    title: "Library services and networks",
    description:
      "Explore library services, university systems and consortia, and the libraries they connect.",
    path: "library-networks",
    locale,
  })
}
export default async function NetworksPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const input = await searchParams,
    query = new URLSearchParams(
      Object.entries(input).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : []
      )
    ),
    data = await publicNetworkList(query)

  return (
    <>
      <PageHero
        title="Library *services & networks*"
        eyebrow="Connected libraries"
        lead="Explore sourced library services, university systems and consortia."
      />
      <Container className="py-10">
        {data ? (
          <NetworkDirectory data={data} query={query} />
        ) : (
          <p role="status">The service directory is temporarily unavailable.</p>
        )}
      </Container>
    </>
  )
}
