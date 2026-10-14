import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { Breadcrumb } from "@/components/ds/Breadcrumb"
import { parseHeroText } from "@/components/ds/PageHero"
import { SectionTabs } from "@/components/ds/SectionTabs"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { NotTranslatedNote } from "@/components/global/NotTranslatedNote"
import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
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
  sectionNumber,
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

      <main className="relative z-10 flex-1">
        {/* ── Hero band + document tabs ── */}
        <section
          className="border-b"
          style={{ background: T.bg.space, borderColor: T.border.line }}
        >
          <Container className="pt-6 sm:pt-10">
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
              className="mt-3 mb-0 text-balance"
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(40px,5vw,68px)",
                fontWeight: 500,
                lineHeight: 1.04,
                letterSpacing: "-0.02em",
                color: T.ink.base,
              }}
            >
              {parseHeroText(doc.heroTitle || title)}
            </h1>

            {untranslatedLocale ? (
              <NotTranslatedNote locale={untranslatedLocale} />
            ) : null}

            <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              {doc.lead ? (
                <p
                  className="m-0 max-w-[60ch] text-[17px] leading-[1.6] text-pretty"
                  style={{ color: T.ink.dim }}
                >
                  {doc.lead}
                </p>
              ) : null}

              <dl className="m-0 flex shrink-0 flex-wrap gap-2">
                {meta.map((item) => (
                  <div
                    className="rounded-[14px] border px-3.5 py-2"
                    key={item.label}
                    style={{
                      background: T.bg.deep,
                      borderColor: T.border.line,
                    }}
                  >
                    <dt className="text-[12px]" style={{ color: T.ink.dim }}>
                      {item.label}
                    </dt>
                    <dd
                      className="m-0 text-[15px] font-semibold"
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

            <div className="mt-6">
              <LegalTabs activeSlug={doc.slug ?? ""} documents={documents} />
            </div>
          </Container>
        </section>

        <Container className="py-10 sm:py-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,680px)] lg:gap-14">
            {/* ── Left: contents + actions ── */}
            <aside className="print:hidden">
              <div className="flex flex-col items-start gap-3 lg:sticky lg:top-[80px]">
                {sections.length > 0 ? (
                  <nav
                    aria-label={tUi("on_this_page")}
                    className="w-full rounded-[20px] border p-5"
                    style={{
                      background: T.bg.deep,
                      borderColor: T.border.line,
                    }}
                  >
                    <p
                      className="m-0 mb-2 text-[14px] font-semibold"
                      style={{ color: T.ink.base }}
                    >
                      {tUi("on_this_page")}
                    </p>
                    <ol className="m-0 flex list-none flex-col p-0">
                      {sections.map((section, index) => (
                        <li key={section.id}>
                          <a
                            className="flex gap-3 py-1 text-[14px] leading-snug text-(--t-ink-dim) transition-colors hover:text-(--t-accent-primary)"
                            href={`#${anchors[index]}`}
                          >
                            <span
                              className="shrink-0 pt-px text-[12px] tabular-nums"
                              style={{
                                fontFamily: T.font.mono,
                                color: T.ink.low,
                              }}
                            >
                              {sectionNumber(index)}
                            </span>
                            {section.heading}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
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
                      className="m-0 text-[15px] font-semibold"
                      id="legal-draft-notice"
                      style={{ color: T.ink.base }}
                    >
                      Pre-launch draft
                    </h2>
                    <p
                      className="mt-1 mb-0 text-[15px] leading-[1.55]"
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
                  className="flex gap-3 rounded-[20px] border p-5 sm:p-6"
                  style={{
                    background: TYPE_TINT.academic.bg,
                    borderColor:
                      "color-mix(in srgb, var(--tint-academic-fg) 20%, transparent)",
                  }}
                >
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                    height={18}
                    icon="mdi:information-outline"
                    style={{ color: TYPE_TINT.academic.fg }}
                    width={18}
                  />
                  <div>
                    <h2
                      className="m-0 text-[15px] font-semibold"
                      id="legal-short-version"
                      style={{ color: T.ink.base }}
                    >
                      The short version
                    </h2>
                    <ul
                      className="mt-2 mb-0 flex list-disc flex-col gap-1 pl-5 text-[15px] leading-[1.55]"
                      style={{ color: T.ink.base }}
                    >
                      {summaryPoints.map((point) => (
                        <li key={point.id}>{point.text}</li>
                      ))}
                    </ul>
                    <p
                      className="mt-3 mb-0 text-[13px] leading-snug"
                      style={{ color: TYPE_TINT.academic.fg }}
                    >
                      These summaries help you read the document but aren’t part
                      of it. The full text below is what applies.
                    </p>
                  </div>
                </aside>
              ) : null}

              {sections.length === 0 ? (
                <p className="mt-8 text-[16px]" style={{ color: T.ink.dim }}>
                  This document has no content yet.
                </p>
              ) : null}

              {sections.map((section, index) => (
                <section
                  aria-labelledby={`${anchors[index]}-heading`}
                  className="scroll-mt-24 border-b py-10"
                  id={anchors[index]}
                  key={section.id}
                  style={{ borderColor: T.border.line }}
                >
                  <h2
                    className="m-0 flex items-baseline gap-3 text-[30px] leading-tight font-medium tracking-[-0.01em]"
                    id={`${anchors[index]}-heading`}
                    style={{ fontFamily: T.font.serif, color: T.ink.base }}
                  >
                    <span
                      className="text-[13px] font-normal tabular-nums"
                      style={{
                        fontFamily: T.font.mono,
                        color: T.accent.primary,
                      }}
                    >
                      {sectionNumber(index)}
                    </span>
                    {section.heading}
                  </h2>

                  {section.inShort ? (
                    <p
                      className="mt-4 mb-0 flex gap-2 rounded-xl border px-4 py-2.5 text-[14px] leading-normal"
                      style={{
                        background: T.bg.deep,
                        borderColor: T.border.line,
                        color: T.ink.dim,
                      }}
                    >
                      <strong
                        className="shrink-0 font-semibold"
                        style={{ color: T.ink.base }}
                      >
                        In short:
                      </strong>
                      <span>{section.inShort}</span>
                    </p>
                  ) : null}

                  <StrapiBlocksContent
                    blocks={section.body as Blocks}
                    className="mt-5 text-[16px] [&_li]:leading-[1.7] [&_p]:leading-[1.7]"
                  />
                </section>
              ))}

              {/* ── Revision history ── */}
              {revisions.length > 0 ? (
                <section aria-labelledby="legal-changes" className="pt-10">
                  <h2
                    className="m-0 text-[24px] font-medium"
                    id="legal-changes"
                    style={{ fontFamily: T.font.serif, color: T.ink.base }}
                  >
                    Changes to this document
                  </h2>
                  <div
                    className="mt-4 overflow-x-auto rounded-2xl border"
                    style={{
                      background: T.bg.deep,
                      borderColor: T.border.line,
                    }}
                  >
                    <table className="w-full border-collapse text-[14px]">
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
                              className="py-3 pr-2 pl-4 text-left align-top text-[13px] font-normal whitespace-nowrap"
                              scope="row"
                              style={{
                                fontFamily: T.font.mono,
                                color: T.accent.primary,
                              }}
                            >
                              {formatVersion(revision.version)}
                            </th>
                            <td
                              className="px-2 py-3 align-top font-semibold whitespace-nowrap"
                              style={{ color: T.ink.base }}
                            >
                              <time dateTime={revision.date}>
                                {formatLegalDate(revision.date, "short")}
                              </time>
                            </td>
                            <td
                              className="px-2 py-3 align-top"
                              style={{ color: T.ink.dim }}
                            >
                              {revision.summary}
                            </td>
                            <td className="py-3 pr-4 pl-2 text-right align-top whitespace-nowrap">
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
                    className="mt-3 mb-0 text-[13px]"
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
                  className="m-0 text-[28px] font-medium"
                  id="legal-questions"
                  style={{ fontFamily: T.font.serif, color: T.ink.base }}
                >
                  Questions about this?
                </h2>
                <p
                  className="mt-2 mb-0 text-[15px]"
                  style={{ color: T.ink.dim }}
                >
                  Ask in the community forum, or write to the maintainers. We
                  reply within 5 working days.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    className="inline-flex items-center rounded-full bg-(--t-accent-primary) px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
                    href={`mailto:${contactEmail}`}
                    data-contact-type={
                      membershipPolicy ? "membership" : "privacy"
                    }
                  >
                    {tUi("email")} {contactEmail}
                  </a>
                  <GlobalLink
                    className="inline-flex items-center rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-4 py-2 text-[14px] font-semibold text-(--t-ink-base) transition-colors hover:bg-(--t-bg-muted)"
                    href={LEGAL_FORUM_URL}
                  >
                    Community forum
                  </GlobalLink>
                </div>
              </section>
            </article>
          </div>
        </Container>
      </main>
    </div>
  )
}

export default LegalDocumentPage
