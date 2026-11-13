import {
  Archive,
  ArrowUpRight,
  BookOpen,
  Bus,
  Code2,
  FileCheck2,
  GraduationCap,
  HeartHandshake,
  Landmark,
  LibraryBig,
  ShieldCheck,
} from "lucide-react"
import { useTranslations } from "next-intl"

import type { AboutLibrary } from "@/components/about/about.types"
import { AboutCoverageChapter } from "@/components/about/AboutCoverageChapter"
import { AboutCoverageSummary } from "@/components/about/AboutCoverageSummary"
import { AboutPhotoSequence } from "@/components/about/AboutPhotoSequence"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import type {
  HomepageContinentSummary,
  HomepageStats,
} from "@/components/home/homepage.types"
import CoverageSection from "@/components/home/sections/CoverageSection"
import FinalCtaSection from "@/components/home/sections/FinalCtaSection"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { tintForLibraryType } from "@/lib/design-tokens"

export function AboutStory({
  stats,
  continents,
  libraries,
}: {
  readonly stats: HomepageStats | null
  readonly continents: HomepageContinentSummary[]
  readonly libraries: readonly AboutLibrary[]
}) {
  const tStatic = useTranslations("staticUi")
  const tDetail = useTranslations("aboutDetail")
  const PRINCIPLES = [
    {
      title: tStatic("about.open_source"),
      Icon: Code2,
      text: tStatic(
        "about.read_the_code_report_an_issue_or_help_improve_the_platform"
      ),
      href: "https://github.com/webbist-js/libraries.global",
      action: tDetail("source"),
    },
    {
      title: tStatic("about.sources_and_attribution"),
      Icon: FileCheck2,
      text: tStatic(
        "about.records_keep_their_sources_data_and_photographs_carry_their_own_credits_and_licence_information"
      ),
      href: "/legal/data-licence",
      action: tDetail("licence"),
    },
    {
      title: tStatic("about.a_transparent_method"),
      Icon: ShieldCheck,
      text: tStatic(
        "about.our_guides_explain_which_institutions_we_include_how_we_count_them_and_where_information_is_missing"
      ),
      href: "/knowledge/data-api/how-we-count",
      action: tDetail("counting"),
    },
    {
      title: tStatic("about.independent_and_shared"),
      Icon: HeartHandshake,
      text: tStatic(
        "about.contributors_improve_the_records_financial_support_pays_for_running_the_project_it_does_not_buy_incl"
      ),
      href: "/community",
      action: tDetail("community"),
    },
  ] as const

  const RECORD_STEPS = [
    {
      title: tStatic("about.start_with_a_source"),
      text: tStatic(
        "about.a_record_starts_with_a_published_dataset_or_a_public_reference_its_source_publisher_credits_and_lice"
      ),
    },
    {
      title: tStatic("about.add_local_knowledge"),
      text: tStatic(
        "about.contributors_add_opening_hours_access_rules_collection_details_and_photographs_links_to_public_sourc"
      ),
    },
    {
      title: tStatic("about.review_and_maintain"),
      text: tStatic(
        "about.reviewers_check_community_contributions_before_they_are_published_accepted_changes_keep_their_histor"
      ),
    },
  ] as const

  const LIBRARY_TYPES = [
    {
      title: tStatic("about.public_libraries"),
      type: "Public",
      Icon: LibraryBig,
      text: tStatic(
        "about.local_branches_and_municipal_libraries_that_serve_their_communities"
      ),
    },
    {
      title: tStatic("about.university_academic"),
      type: "Academic",
      Icon: GraduationCap,
      text: tStatic(
        "about.libraries_for_teaching_study_and_research_with_information_about_who_can_visit"
      ),
    },
    {
      title: tStatic("about.national_parliamentary"),
      type: "National",
      Icon: Landmark,
      text: tStatic(
        "about.institutions_that_preserve_a_country_s_publications_and_libraries_that_support_parliamentary_work"
      ),
    },
    {
      title: tStatic("about.archives_specialist"),
      type: "Special",
      Icon: Archive,
      text: tStatic(
        "about.cultural_collections_archives_and_libraries_devoted_to_a_subject_or_profession"
      ),
    },
    {
      title: tStatic("about.monastic_libraries"),
      type: "Monastic",
      Icon: BookOpen,
      text: tStatic(
        "about.collections_cared_for_by_religious_communities_including_access_by_appointment"
      ),
    },
    {
      title: tStatic("about.mobile_libraries"),
      type: "Mobile",
      Icon: Bus,
      text: tStatic(
        "about.library_services_that_bring_books_and_resources_to_places_without_a_nearby_branch"
      ),
    },
  ] as const

  const tExisting = useTranslations()

  const countryBreakdown = Object.fromEntries(
    continents.flatMap((continent) =>
      continent.slug && continent.countries?.length
        ? [
            [
              continent.slug,
              continent.countries.map(({ name, libraryCount }) => ({
                name,
                count: libraryCount,
              })),
            ],
          ]
        : []
    )
  )

  return (
    <div className="about-story">
      <AboutPhotoSequence libraries={libraries} />
      <section
        id="our-purpose"
        className="about-section about-purpose"
        aria-labelledby="about-purpose-title"
      >
        <Container>
          <div className="about-purpose-layout">
            <div>
              <p className="about-eyebrow">{tStatic("about.our_purpose")}</p>
              <SectionHeader
                id="about-purpose-title"
                intro={{ title: tStatic("about.why_this_index_exists") }}
              />
            </div>
            <div className="about-prose">
              <p>
                {tStatic(
                  "about.a_library_apos_s_address_is_only_part_of_what_a_visitor_needs_opening_hours_access_rules_and_informa"
                )}
              </p>
              <p>
                {tStatic(
                  "about.libraries_global_is_an_independent_project_that_brings_those_details_together_in_an_open_index_organ"
                )}
              </p>
              <p>
                {tStatic(
                  "about.library_staff_can_maintain_their_institution_apos_s_record_researchers_can_compare_what_has_been_doc"
                )}
              </p>
              <GlobalLink href="/libraries" className="about-text-link">
                {tExisting("contactModal.feedback.tasks.find_library")}{" "}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </GlobalLink>
            </div>
          </div>
        </Container>
      </section>

      <section
        id="what-we-include"
        className="about-section"
        aria-labelledby="about-types-title"
      >
        <Container>
          <p className="about-eyebrow">{tStatic("about.what_we_include")}</p>
          <SectionHeader
            id="about-types-title"
            intro={{
              title: tStatic("about.the_libraries_we_include"),
              text: tStatic(
                "about.we_include_libraries_and_archives_that_collect_preserve_or_provide_access_to_recorded_knowledge_some"
              ),
            }}
            textBeside
          />
          <ul className="about-type-grid">
            {LIBRARY_TYPES.map(({ title, type, Icon, text }) => {
              const tint = tintForLibraryType(type)

              return (
                <li key={title} className="about-card">
                  <span
                    className="about-card-icon"
                    style={{ background: tint.bg, color: tint.fg }}
                  >
                    <Icon
                      className="size-5"
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                  </span>
                  <h3 className="type-h3">{title}</h3>
                  <p>{text}</p>
                </li>
              )
            })}
          </ul>
        </Container>
      </section>

      <section
        id="how-we-build-it"
        className="about-section about-process"
        aria-labelledby="about-process-title"
      >
        <Container>
          <p className="about-eyebrow">
            {tStatic("about.how_records_are_built")}
          </p>
          <SectionHeader
            id="about-process-title"
            intro={{
              title: tStatic("about.sources_contributions_and_review"),
              text: tStatic(
                "about.records_develop_over_time_as_sources_are_checked_and_people_add_what_they_know"
              ),
            }}
          />
          <ol className="about-step-grid">
            {RECORD_STEPS.map((step) => (
              <li key={step.title} className="about-step">
                <h3 className="type-h3">{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
          <GlobalLink href="/knowledge" className="about-text-link">
            {tStatic("about.read_the_contribution_guides")}{" "}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </GlobalLink>
        </Container>
      </section>

      <section
        id="where-we-are"
        className="about-section about-coverage"
        aria-labelledby="about-coverage-title"
      >
        <Container className="about-coverage-container">
          <AboutCoverageSummary stats={stats} />
        </Container>
        {continents.length > 0 ? (
          <AboutCoverageChapter
            footer={
              <>
                <p className="about-data-note">
                  {tStatic(
                    "about.help_fill_a_gap_by_adding_a_library_or_improving_a_record_in_an_area_you_know"
                  )}
                </p>
                <GlobalLink href="/map" className="about-text-link">
                  {tStatic("common.exploreCoverage")}{" "}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </GlobalLink>
              </>
            }
          >
            <CoverageSection
              continents={continents}
              countryBreakdown={countryBreakdown}
              intro={{
                title: tStatic("about.by_continent"),
                text: tStatic(
                  "about.each_bar_shows_how_the_continent_s_published_records_are_distributed_between_countries"
                ),
              }}
            />
          </AboutCoverageChapter>
        ) : null}
        {continents.length === 0 ? (
          <Container>
            <p className="about-data-note">
              {tStatic(
                "about.help_fill_a_gap_by_adding_a_library_or_improving_a_record_in_an_area_you_know"
              )}
            </p>
            <GlobalLink href="/map" className="about-text-link">
              {tStatic("common.exploreCoverage")}{" "}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </GlobalLink>
          </Container>
        ) : null}
      </section>

      <section
        id="open-by-design"
        className="about-section about-principles"
        aria-labelledby="about-open-title"
      >
        <Container>
          <p className="about-eyebrow">{tStatic("about.project_principles")}</p>
          <SectionHeader
            id="about-open-title"
            intro={{
              title: tStatic("about.open_to_read_open_to_improve"),
              text: tStatic(
                "about.library_records_are_free_to_browse_the_source_code_is_public_and_our_guides_explain_how_contribution"
              ),
            }}
            textBeside
          />
          <ul className="about-principle-grid">
            {PRINCIPLES.map(({ title, Icon, text, href, action }) => (
              <li key={title} className="about-card">
                <Icon
                  className="size-5 text-(--t-accent-primary)"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
                <h3 className="type-h3">{title}</h3>
                <p>{text}</p>
                <GlobalLink href={href} className="about-text-link">
                  {action}{" "}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </GlobalLink>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section id="take-part" className="about-section about-contribute">
        <Container>
          <FinalCtaSection
            contained
            signedIn={false}
            band={{
              title: tStatic("about.help_document_a_library_you_know"),
              text: tStatic(
                "about.add_a_missing_library_correct_its_opening_hours_or_share_a_photograph_you_took_a_free_account_lets_y"
              ),
              primaryLabel: "Add a library",
              primaryHref: "/contribute/index/new",
              secondaryLabel: "Ways to contribute",
              secondaryHref: "/contribute",
            }}
            benefits={[
              {
                title: tStatic("about.add_what_is_missing"),
                text: tStatic(
                  "about.a_library_its_opening_hours_or_its_access_details"
                ),
              },
              {
                title: tStatic("about.share_a_photograph"),
                text: tStatic(
                  "about.help_people_recognise_a_place_before_they_visit"
                ),
              },
              {
                title: tStatic("about.keep_your_library_current"),
                text: tStatic(
                  "about.library_staff_can_claim_and_maintain_their_record"
                ),
              },
            ]}
          />
          <div className="about-contribute-links">
            <div className="about-contribute-option">
              <p className="about-eyebrow">
                {tExisting("membershipStaff.eyebrow")}
              </p>
              <GlobalLink href="/contribute/claim" className="about-text-link">
                {tStatic("about.represent_your_library")}{" "}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </GlobalLink>
              <p>
                {tStatic(
                  "about.claim_your_institution_apos_s_record_and_keep_its_details_current"
                )}
              </p>
            </div>
            <div className="about-contribute-option">
              <p className="about-eyebrow">
                {tStatic("about.questions_or_ideas")}
              </p>
              <GlobalLink
                href="mailto:info@libraries.global"
                className="about-text-link"
              >
                {tStatic("about.get_in_touch")}{" "}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </GlobalLink>
              <p>
                {tStatic(
                  "about.tell_us_about_a_dataset_a_missing_library_or_an_idea_for_the_project"
                )}
              </p>
            </div>
          </div>
        </Container>
      </section>
    </div>
  )
}
