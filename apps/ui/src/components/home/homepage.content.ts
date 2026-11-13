import type {
  CtaBand,
  Journey,
  LinkCard,
  SectionIntro,
  Step,
} from "@/components/home/homepage.types"

import type messages from "../../../locales/en"

type HomepageTranslate = (key: keyof typeof messages.homepageFallback) => string

/**
 * Fallback copy for every CMS-editable homepage section. The CMS values win
 * field-by-field (see `withFallback`), so an editor can override one line
 * without having to fill the whole component.
 */
type HomepageDefaults = {
  libraryBand: CtaBand
  libraryTools: LinkCard[]
  trustItems: LinkCard[]
  heroEyebrow: string
  heroTitle: string
  heroText: string
  featuredIntro: SectionIntro
  communityBand: CtaBand
  communitySteps: Step[]
  tasksIntro: SectionIntro
  atlasBand: CtaBand
  plansIntro: SectionIntro
  journalIntro: SectionIntro
  knowledgeLinks: LinkCard[]
  finalCta: CtaBand
  openLinks: LinkCard[]
}

export function createHomepageDefaults(t: HomepageTranslate): HomepageDefaults {
  return {
    libraryBand: {
      title: t("work_at_a_library_this_record_is_yours"),
      text: t(
        "claim_your_library_and_keep_its_details_right_at_the_source_hours_services_accessibility_events_and_mobile_stops_publish_once_wherever_the_record_appears"
      ),
      primaryLabel: t("claim_your_library"),
      primaryHref: "/staff/claim",
      secondaryLabel: t("how_verified_staff_access_works"),
      secondaryHref: "/plans#offer-staff",
    },
    libraryTools: [
      {
        title: t("maintain_hours_services_and_accessibility"),
        text: t("free"),
        href: "/staff",
      },
      {
        title: t("publish_notices_and_connect_your_events_feed"),
        text: t("free"),
        href: "/staff",
      },
      {
        title: t("manage_mobile_library_routes_and_stops"),
        text: t("free"),
        href: "/staff",
      },
      {
        title: t("a_free_staff_workspace_for_your_service_or_network"),
        text: t("free"),
        href: "/staff/teams",
      },
      {
        title: t("embeddable_library_finders_and_comparison_tools"),
        text: t("free"),
        href: "/staff/teams/widgets",
      },
      {
        title: t("connect_your_application_to_the_library_api"),
        text: t("api_access"),
        href: "/developers",
      },
    ],
    trustItems: [
      {
        title: t("sources"),
        text: t(
          "library_websites_open_datasets_and_local_knowledge_records_retain_their_sources_so_you_can_follow_the_evidence"
        ),
        href: "/knowledge/data-api/reusing-the-data",
      },
      {
        title: t("review"),
        text: t(
          "community_suggestions_are_checked_before_publication_verified_staff_can_maintain_their_own_library_records_with_a_recorded_history"
        ),
        href: "/knowledge/governance/how-review-works",
      },
      {
        title: t("gaps"),
        text: t(
          "coverage_is_uneven_a_missing_record_means_a_gap_in_the_index_rather_than_a_place_without_a_library"
        ),
        href: "/knowledge/data-api/how-we-count",
      },
      {
        title: t("reuse"),
        text: t(
          "explore_the_source_code_check_each_dataset_s_licence_and_attribution_or_bring_published_records_into_your_own_tools"
        ),
        href: "/knowledge/data-api/reusing-the-data",
      },
    ],
    heroEyebrow: t("open_data_open_source_free_to_use"),
    heroTitle: t("every_library_one_map"),
    heroText: t(
      "find_a_library_near_you_see_when_it_opens_and_what_it_offers_and_help_finish_the_record_free_to_browse_no_account_needed"
    ),

    atlasBand: {
      title: t("see_how_places_are_served"),
      text: t(
        "explore_libraries_on_a_global_map_and_compare_library_coverage_with_population_in_the_uk_choose_a_walking_or_cycling_time_to_see_how_many_people_live_within_reach_of_a_library_or_service"
      ),
      primaryLabel: t("open_the_atlas"),
      primaryHref: "/map",
      secondaryLabel: t("how_to_read_the_atlas"),
      secondaryHref: "/knowledge/getting-started/exploring-the-atlas",
    },

    communityBand: {
      title: t("two_minutes_can_finish_a_record"),
      text: t(
        "you_don_t_need_to_be_a_librarian_share_what_you_know_and_get_credit_for_every_accepted_change"
      ),
      primaryLabel: t("start_contributing"),
      primaryHref: "/contribute",
      secondaryLabel: t("add_a_missing_library"),
      secondaryHref: "/contribute/index/new",
    },

    communitySteps: [
      { title: t("pick_a_gap"), text: null },
      { title: t("add_it_with_a_source"), text: null },
      { title: t("a_reviewer_checks_it"), text: null },
    ],

    tasksIntro: {
      title: t("open_tasks_right_now"),
      text: null,
    },

    featuredIntro: {
      title: t("libraries_worth_knowing"),
      text: t(
        "pillar_institutions_chosen_for_their_national_historical_or_cultural_importance"
      ),
    },

    plansIntro: {
      title: t("library_facts_are_always_free"),
      text: t(
        "explorer_contributor_and_verified_staff_are_free_api_access_and_sponsorship_fund_the_service_and_keep_it_independent_no_ads_and_money_never_buys_a_place_in_the_index"
      ),
    },

    journalIntro: {
      title: t("from_the_journal"),
      text: null,
    },

    knowledgeLinks: [
      {
        title: t("getting_started_finding_and_following_libraries"),
        text: t(
          "browse_by_place_search_and_filter_the_index_or_explore_the_map"
        ),
        href: "/knowledge/getting-started/finding-a-library",
      },
      {
        title: t("reading_a_library_page"),
        href: "/knowledge/getting-started/reading-a-library-page",
      },
      {
        title: t("adding_a_missing_library"),
        href: "/knowledge/contributing/adding-a-missing-library",
      },
      {
        title: t("contributing_and_how_review_works"),
        text: t("who_checks_contributions_and_what_happens_to_yours"),
        href: "/knowledge/governance/how-review-works",
      },
      {
        title: t("managing_your_library_s_record"),
        text: t(
          "how_staff_and_volunteers_become_verified_stewards_of_a_record"
        ),
        href: "/knowledge/contributing/claiming-your-library",
      },
      {
        title: t("using_the_atlas_and_reading_its_layers"),
        href: "/knowledge/getting-started/exploring-the-atlas",
      },
      {
        title: t("how_we_count_libraries_and_coverage"),
        href: "/knowledge/data-api/how-we-count",
      },
      {
        title: t("reusing_the_data_licences_and_api"),
        text: t("the_licence_on_records_and_photos_and_what_it_asks_of_you"),
        href: "/knowledge/data-api/reusing-the-data",
      },
    ],

    // The closing band shows the title and one step per column, the primary
    // call to action under the first and the secondary under the second.
    finalCta: {
      title: t("know_a_library_put_it_on_the_map"),
      text: t(
        "an_open_record_built_together_browsing_and_searching_are_free_membership_supports_the_servers_review_tools_and_analysis_that_keep_the_record_independent"
      ),
      primaryLabel: t("contribute"),
      primaryHref: "/contribute",
      secondaryLabel: t("support_the_project"),
      secondaryHref: "/community/supporters",
    },

    openLinks: [
      {
        title: t("source_code"),
        text: t("the_whole_platform_is_open_source_read_it_fork_it_improve_it"),
        href: "https://github.com/webbist-js/libraries.global",
      },
      {
        title: t("methodology"),
        text: t("what_we_include_how_we_count_and_known_gaps"),
        href: "/knowledge/data-api/how-we-count",
      },
      {
        title: t("data_licence"),
        text: t("reuse_the_index_under_an_open_licence_with_provenance"),
        href: "/legal/data-licence",
      },
    ],
  }
}

/**
 * The contribute prompt above the Find libraries list: the homepage's
 * closing ask, with what an account gets you in place of its two steps.
 */
export function createFindContributePrompt(t: HomepageTranslate): {
  band: CtaBand
  benefits: Step[]
} {
  return {
    band: {
      title: t("know_a_library_put_it_on_the_map_plain"),
      text: t(
        "a_free_account_takes_a_minute_you_get_credit_for_every_accepted_change_and_your_first_one_unlocks_two_reach_calculations_a_week"
      ),
      primaryLabel: t("create_a_free_account"),
      primaryHref: "/auth/register",
      secondaryLabel: t("make_your_first_contribution"),
      secondaryHref: "/contribute",
    },
    benefits: [
      {
        title: t("suggest_and_publish_improvements"),
        text: t("reviewed_sourced_credited_to_you"),
      },
      {
        title: t("follow_the_libraries_you_care_about"),
        text: t("hear_about_changes_and_events"),
      },
      {
        title: t("earn_trust_over_time"),
        text: t("from_contributor_to_reviewer_or_steward"),
      },
      {
        title: t("reach_for_contributors"),
        text: t("two_travel_time_calculations_a_week_free"),
      },
    ],
  }
}

type Nullable<T> = { [K in keyof T]?: T[K] | null }

/** Field-level merge: any blank CMS field falls back to the default. */
export function withFallback<T extends object>(
  cms: Nullable<T> | null | undefined,
  fallback: T
): T {
  const overrides = Object.entries(cms ?? {}).filter(
    ([key, value]) =>
      key !== "id" && key !== "__component" && value != null && value !== ""
  )

  return { ...fallback, ...Object.fromEntries(overrides) }
}

/** Repeatable components: the CMS list replaces the defaults when non-empty. */
export function listOrFallback<T>(
  cms: readonly T[] | null | undefined,
  fallback: readonly T[]
): readonly T[] {
  return Array.isArray(cms) && cms.length > 0 ? cms : fallback
}

type HomepageCms = {
  contentTitle?: string | null
  contentText?: string | null
  contentCtaLabel?: string | null
  contentCtaHref?: string | null
  heroEyebrow?: string | null
  heroTitle?: string | null
  heroText?: string | null
  journeys?: Journey[] | null
  featuredIntro?: SectionIntro | null
  communityBand?: CtaBand | null
  communitySteps?: Step[] | null
  tasksIntro?: SectionIntro | null
  atlasBand?: CtaBand | null
  plansIntro?: SectionIntro | null
  journalIntro?: SectionIntro | null
  knowledgeLinks?: LinkCard[] | null
  finalCta?: CtaBand | null
  openLinks?: LinkCard[] | null
}

export type HomepageContent = {
  readonly [K in keyof HomepageDefaults]: HomepageDefaults[K] extends (infer U)[]
    ? readonly U[]
    : HomepageDefaults[K]
}

/** Resolve every homepage section's copy: CMS first, defaults underneath. */
export function resolveHomepageContent(
  cms: HomepageCms | null | undefined,
  t: HomepageTranslate
): HomepageContent {
  const d = createHomepageDefaults(t)

  return {
    // The existing CMS content CTA, steward journeys and open links own these sections.
    libraryBand: withFallback(
      {
        title: cms?.contentTitle,
        text: cms?.contentText,
        primaryLabel: cms?.contentCtaLabel,
        primaryHref: cms?.contentCtaHref,
      },
      d.libraryBand
    ),
    libraryTools: listOrFallback(
      cms?.journeys
        ?.filter((journey) => journey.tone === "steward")
        .map((journey) => ({
          title: journey.title,
          text: journey.text,
          href: journey.ctaHref,
        })),
      d.libraryTools
    ),
    trustItems: listOrFallback(cms?.openLinks, d.trustItems),
    heroEyebrow: cms?.heroEyebrow || d.heroEyebrow,
    heroTitle: cms?.heroTitle || d.heroTitle,
    heroText: cms?.heroText || d.heroText,
    featuredIntro: withFallback(cms?.featuredIntro, d.featuredIntro),
    communityBand: withFallback(cms?.communityBand, d.communityBand),
    communitySteps: listOrFallback(cms?.communitySteps, d.communitySteps),
    tasksIntro: withFallback(cms?.tasksIntro, d.tasksIntro),
    atlasBand: withFallback(cms?.atlasBand, d.atlasBand),
    plansIntro: withFallback(cms?.plansIntro, d.plansIntro),
    journalIntro: withFallback(cms?.journalIntro, d.journalIntro),
    knowledgeLinks: listOrFallback(cms?.knowledgeLinks, d.knowledgeLinks),
    finalCta: withFallback(cms?.finalCta, d.finalCta),
    openLinks: d.openLinks,
  }
}
