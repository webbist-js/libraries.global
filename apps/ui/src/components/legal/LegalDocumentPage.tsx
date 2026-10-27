import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { Breadcrumb } from "@/components/ds/Breadcrumb"
import { MainContent } from "@/components/ds/MainContent"
import { parseHeroText } from "@/components/ds/PageHero"
import { SectionNavigation } from "@/components/ds/SectionNavigation"
import { SectionTabs } from "@/components/ds/SectionTabs"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { NotTranslatedNote } from "@/components/global/NotTranslatedNote"
import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import { Button } from "@/components/ui/button"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import type {
  LegalDocumentDetail,
  LegalDocumentNavItem,
} from "@/lib/strapi-api/content/server"

import {
  formatLegalDate,
  formatVersion,
  isPreLaunchDraft,
  LEGAL_CONTACT_EMAIL,
  LEGAL_FORUM_URL,
  legalIcon,
  legalReadingMinutes,
  revisionsNewestFirst,
  sectionAnchors,
} from "./legal.helpers"
import { LegalPrintButton } from "./LegalPrintButton"

type Blocks = Parameters<typeof StrapiBlocksContent>[0]["blocks"]

function LegalTabs({
  documents,
  activeSlug,
}: {
  readonly documents: LegalDocumentNavItem[]
  readonly activeSlug: string
}) {
  const tUi = useUiTranslations("ui")

  return (
    <SectionTabs
      activeId={activeSlug}
      label={tUi("legal_documents")}
      tabs={documents.map((doc) => ({
        id: doc.slug ?? doc.documentId,
        label: doc.navLabel || doc.title,
        href: `/legal/${doc.slug}`,
        icon: legalIcon(doc.slug),
      }))}
    />
  )
}

export function LegalDocumentPage({
  document: doc,
  documents,
  locale,
  untranslatedLocale = null,
}: {
  readonly document: LegalDocumentDetail
  readonly documents: LegalDocumentNavItem[]
  readonly locale: Locale
  readonly untranslatedLocale?: string | null
}) {
  const tUi = useUiTranslations("ui")

  const title = doc.title ?? "Legal"
  const membershipPolicy = [
    "membership",
    "cancellation-refunds",
    "beta",
  ].includes(doc.slug ?? "")
  const contactEmail = membershipPolicy
    ? "info@libraries.global"
    : LEGAL_CONTACT_EMAIL
  const sections = doc.sections ?? []
  const anchors = sectionAnchors(sections)
  const summaryPoints = doc.summaryPoints ?? []
  const revisions = revisionsNewestFirst(doc.revisions)
  const current = revisions[0]
  const draft = isPreLaunchDraft(current?.version)

  const meta = [
    {
      label: "Last updated",
      value: formatLegalDate(current?.date ?? doc.updatedAt),
    },
    {
      label: "Version",
      value: current
        ? `${formatVersion(current.version)}${draft ? " (draft)" : ""}`
        : null,
      mono: true,
    },
    { label: "Reading time", value: `${legalReadingMinutes(doc)} min` },
  ].filter((item) => item.value)

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      data-legal-document=""
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <MainContent className="relative z-10 flex-1">
        {/* ── Hero band + document tabs ── */}
        <section
          className="border-b"
          style={{ background: T.bg.space, borderColor: T.border.line }}
        >
          <Container className="pt-6 pb-6 sm:pt-10 sm:pb-8">
            <Breadcrumb
              items={[
                { label: tUi("home"), href: "/" },
                {
                  label: tUi("legal_policies"),
                  href: doc.slug === "beta" ? undefined : "/legal",
                },
                { label: title },
              ]}
            />

            <h1
              className="type-h1 mt-3 mb-0 text-balance"
              style={{
                color: T.ink.base,
              }}
            >
              {parseHeroText(doc.heroTitle || title, "ink")}
            </h1>

            {untranslatedLocale ? (
              <NotTranslatedNote locale={untranslatedLocale} />
            ) : null}

            <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              {doc.lead ? (
                <p
                  className="m-0 max-w-[60ch] text-base leading-[1.6] text-pretty"
                  style={{ color: T.ink.dim }}
                >
                  {doc.lead}
                </p>
              ) : null}

              <dl className="m-0 flex flex-wrap items-baseline gap-x-6 gap-y-3 text-sm lg:justify-end">
                {meta.map((item) => (
                  <div
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
                    key={item.label}
                  >
                    <dt style={{ color: T.ink.dim }}>{item.label}</dt>
                    <dd
                      className="m-0 font-semibold"
                      style={{
                        color: T.ink.base,
                        fontFamily: item.mono ? T.font.mono : undefined,
                      }}
                    >
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Container>
        </section>
        {documents.length > 1 ? (
          <SectionNavigation>
            <LegalTabs activeSlug={doc.slug ?? ""} documents={documents} />
          </SectionNavigation>
        ) : null}

        <Container className="py-10 sm:py-12">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,720px)] lg:gap-12 xl:gap-14">
            {/* ── Left: contents + actions ── */}
            <aside className="print:hidden">
              <div className="flex flex-col items-start gap-3 lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:pb-1">
                {sections.length > 0 ? (
                  <div className="min-h-0 w-full">
                    <LegalContents
                      label={tUi("on_this_page")}
                      items={sections.map((section, index) => ({
                        id: anchors[index]!,
                        label: section.heading,
                      }))}
                    />
                  </div>
                ) : null}
                <LegalPrintButton />
              </div>
            </aside>

            {/* ── Main: the document ── */}
            <article className="min-w-0">
              {draft ? (
                <aside
                  aria-labelledby="legal-draft-notice"
                  className="mb-6 flex gap-3 rounded-[20px] border p-5 sm:p-6"
                  data-legal-draft=""
                  style={{
                    background: TYPE_TINT.special.bg,
                    borderColor:
                      "color-mix(in srgb, var(--tint-special-fg) 25%, transparent)",
                  }}
                >
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                    height={18}
                    icon="mdi:file-document-edit-outline"
                    style={{ color: TYPE_TINT.special.fg }}
                    width={18}
                  />
                  <div>
                    <h2
                      className="type-panel-title m-0"
                      id="legal-draft-notice"
                      style={{ color: T.ink.base }}
                    >
                      Pre-launch draft
                    </h2>
                    <p
                      className="mt-1 mb-0 text-base leading-[1.55]"
                      style={{ color: T.ink.base }}
                    >
                      Libraries Global hasn’t launched yet. This is a working
                      draft: it hasn’t been published as terms governing public
                      use of the service, and nobody has been asked to accept
                      it. The final text will be published as version 1.0, with
                      its effective date, before the service opens.
                    </p>
                  </div>
                </aside>
              ) : null}

              {summaryPoints.length > 0 ? (
                <aside
                  aria-labelledby="legal-short-version"
                  className="rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-7"
                >
                  <h2
                    className="type-label m-0 text-(--t-accent-primary) uppercase"
                    id="legal-short-version"
                  >
                    The short version
                  </h2>
                  <ul
                    className="mt-4 mb-0 grid list-none gap-3 p-0 text-base leading-relaxed"
                    style={{ color: T.ink.base }}
                  >
                    {summaryPoints.map((point) => (
                      <li key={point.id} className="flex items-start gap-3">
                        <Icon
                          aria-hidden="true"
                          icon="mdi:check"
                          width={19}
                          height={19}
                          className="mt-1 shrink-0 text-(--t-accent-ok)"
                        />
                        <span>{point.text}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 mb-0 border-t border-(--t-border-line) pt-4 text-base leading-relaxed text-(--t-ink-dim)">
                    These summaries help you read the document but aren’t part
                    of it. The full text below is what applies.
                  </p>
                </aside>
              ) : null}

              {sections.length === 0 ? (
                <p className="mt-8 text-base" style={{ color: T.ink.dim }}>
                  This document has no content yet.
                </p>
              ) : null}

              {sections.map((section, index) => (
                <section
                  aria-labelledby={`${anchors[index]}-heading`}
                  className="scroll-mt-(--sticky-content-top) border-b py-8 sm:py-10"
                  id={anchors[index]}
                  key={section.id}
                  style={{ borderColor: T.border.line }}
                >
                  <h2
                    className="type-h2 m-0 [break-after:avoid-page]"
                    id={`${anchors[index]}-heading`}
                    style={{ color: T.ink.base }}
                  >
                    {section.heading}
                  </h2>

                  {section.inShort ? (
                    <p
                      className="mt-3 mb-0 [break-after:avoid-page] text-lg leading-relaxed italic"
                      style={{
                        fontFamily: T.font.sans,
                        color: T.ink.dim,
                      }}
                    >
                      {section.inShort}
                    </p>
                  ) : null}

                  <StrapiBlocksContent
                    blocks={section.body as Blocks}
                    className="mt-4 text-base [&_li]:leading-[1.75] [&_p]:leading-[1.75]"
                  />
                </section>
              ))}

              {/* ── Revision history ── */}
              {revisions.length > 0 ? (
                <section aria-labelledby="legal-changes" className="pt-10">
                  <h2
                    className="type-h2 m-0"
                    id="legal-changes"
                    style={{ color: T.ink.base }}
                  >
                    Changes to this document
                  </h2>
                  <div
                    role="region"
                    aria-labelledby="legal-changes"
                    tabIndex={0}
                    className="mt-4 overflow-x-auto rounded-2xl border focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)"
                    style={{
                      background: T.bg.deep,
                      borderColor: T.border.line,
                    }}
                  >
                    <table className="w-full border-collapse text-base leading-relaxed">
                      <caption className="sr-only">
                        Revision history of the {title.toLowerCase()}
                      </caption>
                      <thead className="sr-only">
                        <tr>
                          <th scope="col">Version</th>
                          <th scope="col">Date</th>
                          <th scope="col">{tUi("what_changed")}</th>
                          <th scope="col">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revisions.map((revision) => (
                          <tr
                            className="border-t first:border-t-0"
                            key={revision.id}
                            style={{ borderColor: T.border.divider }}
                          >
                            <th
                              className="py-4 pr-2 pl-4 text-left align-top text-sm font-medium whitespace-nowrap"
                              scope="row"
                              style={{
                                fontFamily: T.font.mono,
                                color: T.accent.primary,
                              }}
                            >
                              {formatVersion(revision.version)}
                            </th>
                            <td
                              className="px-3 py-4 align-top font-semibold whitespace-nowrap"
                              style={{ color: T.ink.base }}
                            >
                              <time dateTime={revision.date}>
                                {formatLegalDate(revision.date, "short")}
                              </time>
                            </td>
                            <td
                              className="min-w-[230px] px-3 py-4 align-top"
                              style={{ color: T.ink.dim }}
                            >
                              {revision.summary}
                            </td>
                            <td className="py-4 pr-4 pl-3 text-right align-top whitespace-nowrap">
                              {revision.changesUrl ? (
                                <GlobalLink
                                  className="font-semibold text-(--t-accent-primary) underline underline-offset-[3px] hover:text-(--t-accent-primary-hover)"
                                  href={revision.changesUrl}
                                >
                                  See changes
                                  <span className="sr-only">
                                    {" "}
                                    in {formatVersion(revision.version)}
                                  </span>
                                </GlobalLink>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p
                    className="mt-3 mb-0 text-sm leading-relaxed"
                    style={{ color: T.ink.dim }}
                  >
                    We announce material changes in the journal and by email to
                    account holders at least 30 days before they apply.
                  </p>
                </section>
              ) : null}

              {/* ── Questions ── */}
              <section
                aria-labelledby="legal-questions"
                className="mt-10 rounded-3xl p-6 sm:p-8 print:hidden"
                style={{ background: TYPE_TINT.national.bg }}
              >
                <h2
                  className="type-h2 m-0"
                  id="legal-questions"
                  style={{ color: T.ink.base }}
                >
                  Questions about this?
                </h2>
                <p
                  className="mt-2 mb-0 text-base leading-relaxed"
                  style={{ color: T.ink.dim }}
                >
                  Ask in the community forum, or write to the maintainers. We
                  reply within 5 working days.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button asChild variant="primary" size="pill">
                    <a
                      href={`mailto:${contactEmail}`}
                      data-contact-type={
                        membershipPolicy ? "membership" : "privacy"
                      }
                    >
                      {tUi("email")} {contactEmail}
                    </a>
                  </Button>
                  <Button asChild variant="surface" size="pill">
                    <GlobalLink href={LEGAL_FORUM_URL}>
                      Community forum
                    </GlobalLink>
                  </Button>
                </div>
              </section>
            </article>
          </div>
        </Container>
      </MainContent>
    </div>
  )
}

export default LegalDocumentPage

function LegalContents({
  items,
  label,
}: {
  readonly items: readonly { id: string; label: string }[]
  readonly label: string
}) {
  const links = (
    <ul className="scrollbar-thin m-0 min-h-0 list-none overflow-y-auto overscroll-contain p-0 [scrollbar-gutter:stable]">
      {items.map((item) => (
        <li key={item.id}>
          <a
            className="flex min-h-11 items-center rounded-lg px-3 py-2 text-base leading-snug text-(--t-ink-dim) no-underline transition-colors hover:bg-(--t-accent-chip) hover:text-(--t-accent-primary) focus-visible:bg-(--t-accent-chip) focus-visible:text-(--t-accent-primary) focus-visible:outline-2 focus-visible:-outline-offset-2 lg:min-h-9 lg:py-1.5"
            href={`#${item.id}`}
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <nav
        aria-label={label}
        className="hidden min-h-0 w-full flex-col rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-3 lg:flex"
        style={{
          maxHeight:
            "min(560px, calc(var(--sticky-content-max-height) - 64px))",
        }}
      >
        <p className="m-0 shrink-0 px-3 pt-1 pb-3 text-base font-semibold">
          {label}
        </p>
        {links}
      </nav>
      <details className="group w-full rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-4 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
          {label}
          <Icon
            aria-hidden="true"
            icon="mdi:chevron-down"
            width={20}
            className="shrink-0 transition-transform group-open:rotate-180"
          />
        </summary>
        <nav
          aria-label={label}
          className="scrollbar-thin mt-3 max-h-[min(420px,60dvh)] overflow-y-auto overscroll-contain border-t border-(--t-border-line) pt-3"
        >
          {links}
        </nav>
      </details>
    </>
  )
}
