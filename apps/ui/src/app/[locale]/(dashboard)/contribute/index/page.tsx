import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { FeatureAccessLanding } from "@/components/auth/FeatureAccessLanding"
import { MainContent } from "@/components/ds/MainContent"
import { StepsCard } from "@/components/ds/StepsCard"
import { Container } from "@/components/elementary/Container"
import { WIZARD_CARD } from "@/components/library-editor/wizard.constants"
import { Button } from "@/components/ui/button"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"
import { fetchIncompleteLibraries } from "@/lib/strapi-api/content/server"

import { ContributeSectionHeader } from "../_components/ContributeSectionHeader"
import {
  FindLibraryFirst,
  type RecordNeedingHelp,
} from "./_components/FindLibraryFirst"

export const metadata = privateMetadata("Index editor")

const NEXT_STEPS = [
  {
    title: "You make changes.",
    body: "Your draft saves as you go.",
  },
  {
    title: "A reviewer checks the source.",
    body: "Usually within a few days.",
  },
  {
    title: "It goes live, credited to you.",
    body: "The record keeps its full history.",
  },
]

export default async function IndexEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>
}) {
  const tUi = await getUiTranslations("ui")
  const tClaim = await getUiTranslations("libraryClaim")

  const [{ intent }, session] = await Promise.all([
    searchParams,
    getSessionSSR(await headers()),
  ])
  // Keep old bookmarks working; claims now have a dedicated entry page.
  if (intent === "claim") redirect("/contribute/claim")
  if (!session?.user) {
    return <FeatureAccessLanding feature="index" />
  }

  const needsHelp: RecordNeedingHelp[] = (await fetchIncompleteLibraries())
    .slice(0, 3)
    .map((record) => ({
      documentId: record.documentId,
      slug: record.slug,
      name: record.name,
      place: record.place,
      libraryType: record.libraryType,
      missing: record.missing,
    }))

  return (
    <div style={{ color: T.ink.base }}>
      <ContributeSectionHeader
        section={tUi("index_editor")}
        title="Add or improve *a library.*"
        lead="Search the index first. Improve the record if it’s there, or add it if it isn’t. An editor reviews every change before it goes live."
      />
      <Container className="py-8 lg:py-10">
        <MainContent className="grid min-w-0 gap-6">
          <div className="grid min-w-0 gap-6">
            <section
              className={WIZARD_CARD}
              aria-label={tUi("find_the_library_first")}
            >
              <FindLibraryFirst needsHelp={needsHelp} />
            </section>
            <section className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-(--t-border-line) bg-(--t-accent-chip) p-6">
              <div className="max-w-[52ch]">
                <h2 className="type-panel-title m-0">{tClaim("workHere")}</h2>
                <p className="mt-2 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
                  {tClaim("ctaBody")}
                </p>
              </div>
              <Button asChild variant="primary" size="pill">
                <Link href="/contribute/claim">{tClaim("title")}</Link>
              </Button>
            </section>
            <StepsCard
              title="What happens next"
              steps={NEXT_STEPS.map((step) => ({
                id: step.title,
                content: (
                  <>
                    <strong className="block text-white">{step.title}</strong>
                    {step.body}
                  </>
                ),
              }))}
            />
          </div>
        </MainContent>
      </Container>
    </div>
  )
}
