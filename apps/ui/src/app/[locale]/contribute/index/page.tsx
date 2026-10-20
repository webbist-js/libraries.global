import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { MainContent } from "@/components/ds/MainContent"
import { StepsCard } from "@/components/ds/StepsCard"
import { Container } from "@/components/elementary/Container"
import {
  WIZARD_GRID,
  WIZARD_RAIL,
  WIZARD_CARD,
} from "@/components/library-editor/wizard.constants"
import { WizardStepNav } from "@/components/library-editor/WizardStepNav"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
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

  const [{ intent }, session] = await Promise.all([
    searchParams,
    getSessionSSR(await headers()),
  ])
  // ?intent=claim: the reader came to claim their library, not to edit.
  const claiming = intent === "claim"
  if (!session?.user) {
    const back = claiming
      ? "/contribute/index?intent=claim"
      : "/contribute/index"
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(back)}`)
  }

  const needsHelp: RecordNeedingHelp[] = (await fetchIncompleteLibraries())
    .slice(0, 3)
    .map((record) => ({
      documentId: record.documentId,
      slug: record.slug,
      name: record.name,
      place: record.place,
      missing: record.missing,
    }))

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        section={tUi("index_editor")}
        title="Add or improve *a library.*"
        lead="Search the index first. Improve the record if it’s there, or add it if it isn’t. An editor reviews every change before it goes live."
      />
      <Container className="py-8 lg:py-10">
        <MainContent className={WIZARD_GRID}>
          <aside
            className={`${WIZARD_RAIL} hidden lg:block`}
            aria-label="Your record"
          >
            <h2 className="m-0 font-serif text-[24px] leading-tight font-medium">
              {tUi("your_record")}
            </h2>
            <p className="mt-2 mb-5 text-[15px] text-(--t-ink-dim)">
              Choose a library to start
            </p>
            <WizardStepNav
              preview
              currentStep={0}
              progress={[]}
              findHref="/contribute/index"
            />
          </aside>
          <div className="grid min-w-0 gap-6">
            <section
              className={WIZARD_CARD}
              aria-label={tUi("find_the_library_first")}
            >
              {claiming && (
                <p
                  role="status"
                  className="mb-5 rounded-2xl bg-(--t-accent-chip) p-4 text-[15px] leading-relaxed"
                >
                  Find your library, then choose Claim on its page.
                </p>
              )}
              <FindLibraryFirst
                needsHelp={needsHelp}
                intent={claiming ? "claim" : "edit"}
              />
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
