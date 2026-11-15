"use client"

import { ArrowUpRight, Check, Plus, RotateCcw } from "lucide-react"
import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import type { GlobeNarrativeController } from "@/components/home/knowledge-globe-narrative"
import { Link } from "@/lib/navigation"

const NarrativeContext = createContext<GlobeNarrativeController | null>(null)

/** Restore each chapter's selected control when its scene becomes active. */
function useChapterFocus(chapter: number, focus: number) {
  const narrative = useContext(NarrativeContext)
  const localFocus = useRef(focus)
  useEffect(() => {
    localFocus.current = focus
  }, [focus])
  useEffect(() => {
    if (!narrative) return
    let previousChapter = Number.NaN
    const syncFocus = () => {
      const activeChapter = Math.round(narrative.current.progress)
      if (activeChapter === previousChapter) return
      previousChapter = activeChapter
      if (activeChapter === chapter)
        narrative.set({ focus: localFocus.current })
    }
    syncFocus()

    return narrative.subscribe(syncFocus)
  }, [chapter, narrative])

  return narrative
}

export function AboutNarrativeProvider({
  narrative,
  children,
}: {
  readonly narrative: GlobeNarrativeController
  readonly children: ReactNode
}) {
  return (
    <NarrativeContext.Provider value={narrative}>
      {children}
    </NarrativeContext.Provider>
  )
}

export type AboutPhotograph = {
  src: string
  alt: string
  caption?: string
  story?: string
  credit?: string
  href?: string
}

export function LibraryContexts({
  photographs = [],
}: {
  readonly photographs?: readonly AboutPhotograph[]
}) {
  const tStatic = useTranslations("staticUi")
  const tDetail = useTranslations("aboutDetail")

  const CONTEXTS = [
    {
      title: tStatic("about.reading"),
      text: tStatic("about.a_quiet_desk_a_first_library_card"),
      caption: tDetail("sit"),
      kind: "room",
    },
    {
      title: tStatic("about.research"),
      text: tStatic("about.a_question_that_leads_into_a_collection"),
      caption: tDetail("question"),
      kind: "shelves",
    },
    {
      title: tStatic("about.memory"),
      text: tStatic("about.the_records_a_community_keeps"),
      caption: tDetail("keep"),
      kind: "archive",
    },
    {
      title: tStatic("about.mobile"),
      text: tStatic("about.a_library_that_comes_to_you"),
      caption: tDetail("comes"),
      kind: "mobile",
    },
  ] as const

  const [selected, setSelected] = useState(0)
  const narrative = useChapterFocus(1, selected)
  const choose = (index: number) => {
    setSelected(index)
    narrative?.set({ focus: index })
  }

  return (
    <div
      className="about-context-strip"
      role="group"
      aria-label={tStatic("about.what_a_library_makes_possible")}
    >
      {CONTEXTS.map((context, index) => {
        const photograph = photographs[index]

        return (
          <figure
            className="about-context-panel"
            key={context.title}
            data-context={context.kind}
          >
            <button
              className="about-context-frame"
              type="button"
              aria-label={
                photograph
                  ? `${photograph.caption ?? photograph.alt}. ${photograph.story ?? tDetail("shared")}`
                  : `${context.title} ${context.text}`
              }
              aria-pressed={selected === index}
              onMouseEnter={() => choose(index)}
              onFocus={() => choose(index)}
              onClick={() => choose(index)}
            >
              {photograph ? (
                <Image
                  src={photograph.src}
                  alt={photograph.alt}
                  fill
                  sizes="(max-width: 760px) 80vw, 700px"
                  className="about-context-photo"
                />
              ) : (
                <span className="about-context-placeholder" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <strong>{context.title}</strong>
                </span>
              )}
            </button>
            <figcaption className="about-context-caption">
              <span className="about-item-number">
                {String(index + 1).padStart(2, "0")} ·{" "}
                {photograph?.caption ?? context.title}
              </span>
              <span>
                {photograph
                  ? (photograph.story ?? tDetail("shared"))
                  : context.caption}
              </span>
              {photograph?.credit ? (
                <small className="about-photo-credit">
                  {photograph.credit}
                </small>
              ) : null}
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}

export function LibraryTypes() {
  const tStatic = useTranslations("staticUi")

  const TYPES = [
    {
      title: tStatic("about.public_libraries"),
      text: tStatic("about.the_local_branch_open_to_its_community"),
      x: 17,
      y: 24,
      size: "clamp(40px,5.6vw,96px)",
    },
    {
      title: tStatic("about.university_academic"),
      text: tStatic("about.collections_for_study_and_research"),
      x: 68,
      y: 14,
      size: "clamp(28px,3.4vw,58px)",
    },
    {
      title: tStatic("about.national_parliamentary"),
      text: tStatic("about.the_records_and_collections_of_a_country"),
      x: 79,
      y: 47,
      size: "clamp(30px,3.8vw,66px)",
    },
    {
      title: tStatic("about.archives_cultural"),
      text: tStatic("about.manuscripts_memory_and_specialist_knowledge"),
      x: 22,
      y: 60,
      size: "clamp(30px,4vw,70px)",
    },
    {
      title: tStatic("about.monastic_libraries"),
      text: tStatic("about.collections_cared_for_across_generations"),
      x: 52,
      y: 86,
      size: "clamp(26px,3vw,52px)",
    },
    {
      title: tStatic("about.mobile_libraries"),
      text: tStatic("about.library_services_that_come_to_their_communities"),
      x: 84,
      y: 82,
      size: "clamp(26px,3.2vw,56px)",
    },
  ] as const

  const tExisting = useTranslations()

  const [selected, setSelected] = useState(0)
  const narrative = useChapterFocus(2, selected)
  const choose = (index: number) => {
    setSelected(index)
    narrative?.set({ focus: index })
  }

  return (
    <div className="about-type-constellation" data-about-scene="2">
      <svg
        className="about-type-connectors"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {TYPES.map((type, index) => (
          <line
            key={type.title}
            x1="48"
            y1="52"
            x2={type.x}
            y2={type.y}
            data-active={selected === index}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="about-type-center" aria-hidden="true">
        <i />
        <span>{tStatic("about.one_open_index")}</span>
      </div>
      <div
        className="about-type-labels"
        role="group"
        aria-label={tStatic("about.kinds_of_library")}
      >
        {TYPES.map((type, index) => (
          <button
            className="about-type-label"
            key={type.title}
            type="button"
            style={{
              left: `${type.x}%`,
              top: `${type.y}%`,
              fontSize: type.size,
            }}
            aria-pressed={selected === index}
            onMouseEnter={() => choose(index)}
            onFocus={() => choose(index)}
            onClick={() => choose(index)}
          >
            <span className="about-type-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <strong>{type.title}</strong>
            <span className="sr-only">{type.text}</span>
          </button>
        ))}
      </div>
      <div className="about-type-caption" aria-live="polite" aria-atomic="true">
        <span className="about-interaction-label">
          {String(selected + 1).padStart(2, "0")} / 06 ·{" "}
          {TYPES[selected]!.title}
        </span>
        <p>{TYPES[selected]!.text}</p>
        <Link href="/libraries" className="about-text-link">
          {tExisting("aboutCoverage.browse")}{" "}
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

export function RecordSteps({ children }: { readonly children?: ReactNode }) {
  const tStatic = useTranslations("staticUi")
  const tDetail = useTranslations("aboutDetail")

  const RECORD_STEPS = [
    {
      title: tStatic("about.start_with_a_source"),
      text: tStatic(
        "about.published_datasets_and_public_references_establish_a_record_original_provenance_publisher_credits_an"
      ),
    },
    {
      title: tStatic("about.add_what_people_know"),
      text: tStatic(
        "about.library_websites_photographs_and_local_knowledge_add_useful_details_with_public_sources_to_support_t"
      ),
    },
    {
      title: tStatic("about.review_then_keep_the_history"),
      text: tStatic(
        "about.community_contributions_are_checked_before_they_appear_accepted_changes_leave_a_history_approved_lib"
      ),
    },
  ] as const

  const narrative = useContext(NarrativeContext)
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!narrative) return
    const syncStep = () => {
      if (Math.round(narrative.current.progress) !== 3) return
      const next = Math.max(0, Math.min(2, Math.round(narrative.current.step)))
      setStep(next)
    }
    syncStep()

    return narrative.subscribe(syncStep)
  }, [narrative])
  const choose = (index: number) => {
    setStep(index)
    narrative?.set({ step: index })
  }

  return (
    <div className="about-process-sticky">
      <div className="about-process-copy">
        {children}
        <ol
          className="about-record-steps"
          aria-label={tStatic("about.how_a_library_record_develops")}
        >
          {RECORD_STEPS.map((item, index) => (
            <li key={item.title}>
              <button
                className="about-record-step"
                type="button"
                aria-current={step === index ? "step" : undefined}
                aria-controls="about-example-record"
                onClick={() => choose(index)}
              >
                <span className="about-item-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <Link href="/knowledge" className="about-text-link">
          {tStatic("about.see_how_review_works")}{" "}
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <div
        className="about-record-demo"
        data-about-scene="3"
        id="about-example-record"
      >
        <div className="about-record-grid" aria-hidden="true" />
        <div className="about-record-content">
          <p className="about-record-kicker">
            {tStatic("about.an_illustrative_record")}
          </p>
          <h3 className="type-h3">{tStatic("about.a_library_better_known")}</h3>
          <div className="about-record-layers">
            <div className="about-record-layer" data-visible="true">
              <span className="about-record-field-label">
                {tStatic("about.the_foundation")}
              </span>
              <p>{tStatic("about.name_institution_type_and_location")}</p>
              <small>
                {tStatic(
                  "about.a_published_source_with_its_credit_and_licence"
                )}
              </small>
            </div>
            <div
              className="about-record-layer"
              data-visible={step >= 1}
              aria-hidden={step < 1}
            >
              <span className="about-record-field-label">
                {tStatic("about.local_knowledge")}
              </span>
              <p>{tStatic("about.hours_access_details_and_a_photograph")}</p>
              <small>
                {tStatic(
                  "about.useful_information_supported_by_public_references"
                )}
              </small>
            </div>
            <div
              className="about-record-layer"
              data-visible={step >= 2}
              aria-hidden={step < 2}
            >
              <span className="about-record-field-label">
                <Check size={13} aria-hidden="true" />{" "}
                {tStatic("about.reviewed_and_credited")}
              </span>
              <p>{tStatic("about.a_record_with_a_history")}</p>
              <small>
                {tStatic(
                  "about.accepted_changes_stay_traceable_to_their_sources"
                )}
              </small>
            </div>
          </div>
          <p
            className="about-record-status"
            aria-live="polite"
            aria-atomic="true"
          >
            {tDetail("stage", {
              stage: step + 1,
              total: 3,
              title: RECORD_STEPS[step]!.title,
            })}
          </p>
        </div>
      </div>
    </div>
  )
}

const CONTINENT_FOCUS: Readonly<Record<string, number>> = {
  europe: 0,
  asia: 1,
  africa: 2,
  "north-america": 3,
  "south-america": 4,
  oceania: 5,
  antarctica: 6,
}

const CONTINENT_POSITION: Readonly<Record<string, { x: number; y: number }>> = {
  europe: { x: 53.3, y: 22.2 },
  asia: { x: 75.6, y: 32.2 },
  africa: { x: 55.6, y: 47.8 },
  "north-america": { x: 23.1, y: 27.2 },
  "south-america": { x: 33.3, y: 58.3 },
  oceania: { x: 89.4, y: 65.6 },
  antarctica: { x: 50, y: 90 },
}

export function CoverageExplorer({
  continents,
  locale,
}: {
  readonly continents: readonly HomepageContinentSummary[]
  readonly locale?: string
}) {
  const tStatic = useTranslations("staticUi")
  const tDetail = useTranslations("aboutDetail")

  const tExisting = useTranslations()

  const [scale, setScale] = useState<"count" | "log">("count")
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const narrative = useChapterFocus(
    4,
    CONTINENT_FOCUS[hovered ?? selected ?? "europe"] ?? 0
  )
  const coverage = continents
    .filter((continent) => continent.name && continent.slug)
    .sort((a, b) => b.libraryCount - a.libraryCount)
  const activeLocale = useLocale()
  const number = new Intl.NumberFormat(locale ?? activeLocale)
  const total = coverage.reduce(
    (sum, continent) => sum + continent.libraryCount,
    0
  )
  const largest = Math.max(
    1,
    ...coverage.map((continent) => continent.libraryCount)
  )
  const focus = hovered ?? selected
  const current = coverage.find((continent) => continent.slug === focus)
  const pointAt = (slug: string) => {
    const index = CONTINENT_FOCUS[slug]
    if (index !== undefined) narrative?.set({ focus: index })
  }

  return (
    <div className="about-coverage-explorer">
      <div
        className="about-map-slot"
        data-about-scene="4"
        aria-label={tStatic("about.published_library_records_across_the_world")}
      >
        {coverage.map((continent) => {
          const slug = continent.slug!
          const position = CONTINENT_POSITION[slug]
          if (!position) return null

          return (
            <button
              key={continent.documentId}
              className="about-map-label"
              type="button"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              aria-pressed={selected === slug}
              data-active={focus === slug}
              onMouseEnter={() => {
                setHovered(slug)
                pointAt(slug)
              }}
              onMouseLeave={() => {
                setHovered(null)
                if (selected) pointAt(selected)
              }}
              onFocus={() => {
                setHovered(slug)
                pointAt(slug)
              }}
              onBlur={() => {
                setHovered(null)
                if (selected) pointAt(selected)
              }}
              onClick={() => {
                setSelected(selected === slug ? null : slug)
                pointAt(slug)
              }}
            >
              <span>{continent.name}</span>
              <strong aria-hidden="true">
                {number.format(continent.libraryCount)}
              </strong>
              <span className="sr-only">
                {tDetail("documented", { count: continent.libraryCount })}
              </span>
            </button>
          )
        })}
      </div>
      <div className="about-coverage-bottom">
        <div className="about-coverage-chart">
          <div className="about-coverage-controls">
            <p className="about-interaction-label">
              {tStatic("about.published_records_by_continent")}
            </p>
            <div
              className="about-scale-buttons"
              role="group"
              aria-label={tStatic("about.coverage_bar_scale")}
            >
              <button
                type="button"
                aria-pressed={scale === "count"}
                onClick={() => setScale("count")}
              >
                {tExisting("widgetSettings.count")}
              </button>
              <button
                type="button"
                aria-pressed={scale === "log"}
                onClick={() => setScale("log")}
              >
                {tStatic("about.log_scale")}
              </button>
            </div>
          </div>
          {coverage.length > 0 ? (
            <ul className="about-coverage-list">
              {coverage.map((continent) => {
                const slug = continent.slug!
                const width =
                  scale === "log"
                    ? (Math.log10(continent.libraryCount + 1) /
                        Math.log10(largest + 1)) *
                      100
                    : (continent.libraryCount / largest) * 100
                const share =
                  total > 0 ? (continent.libraryCount / total) * 100 : 0
                const shareLabel =
                  share > 0 && share < 1
                    ? "<1%"
                    : `${number.format(Math.round(share))}%`

                return (
                  <li key={continent.documentId}>
                    <button
                      className="about-coverage-row"
                      type="button"
                      aria-pressed={selected === slug}
                      data-active={focus === slug}
                      data-empty={continent.libraryCount === 0}
                      onMouseEnter={() => {
                        setHovered(slug)
                        pointAt(slug)
                      }}
                      onMouseLeave={() => {
                        setHovered(null)
                        if (selected) pointAt(selected)
                      }}
                      onFocus={() => {
                        setHovered(slug)
                        pointAt(slug)
                      }}
                      onBlur={() => {
                        setHovered(null)
                        if (selected) pointAt(selected)
                      }}
                      onClick={() => {
                        setSelected(selected === slug ? null : slug)
                        pointAt(slug)
                      }}
                    >
                      <span className="about-coverage-name">
                        {continent.name}
                      </span>
                      <span className="about-coverage-bar" aria-hidden="true">
                        <span style={{ transform: `scaleX(${width / 100})` }} />
                      </span>
                      <span className="about-coverage-count">
                        <span aria-hidden="true">
                          {number.format(continent.libraryCount)}
                        </span>
                        <span className="sr-only">
                          {tDetail("publishedLibraries", {
                            count: continent.libraryCount,
                          })}
                        </span>
                      </span>
                      <span className="about-coverage-share">
                        <span aria-hidden="true">{shareLabel}</span>
                        <span className="sr-only">
                          {tDetail("share", { share: shareLabel })}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="about-coverage-note">
              {tStatic(
                "about.coverage_counts_are_unavailable_at_the_moment_you_can_still_explore_the_atlas"
              )}
            </p>
          )}
        </div>
        <div
          className="about-coverage-detail"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="about-interaction-label">
            {current?.name ?? tDetail("forming")}
          </p>
          <p>
            {current
              ? tDetail("soFar", { count: current.libraryCount })
              : tDetail("choose")}
          </p>
          <span>
            {tStatic(
              "about.counts_describe_the_index_they_do_not_measure_how_many_libraries_exist_in_a_place"
            )}
          </span>
          <Link
            href={current?.slug ? `/${current.slug}` : "/map"}
            className="about-text-link"
          >
            {current?.name
              ? tDetail("explore", { place: current.name })
              : tDetail("atlas")}{" "}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <p className="about-coverage-note">
        {tStatic(
          "about.log_scale_makes_small_counts_easier_to_compare_numbers_and_shares_stay_the_same"
        )}
      </p>
    </div>
  )
}

export function OpenPrinciples() {
  const tStatic = useTranslations("staticUi")

  const PRINCIPLES = [
    {
      title: tStatic("about.source_code"),
      text: tStatic(
        "about.read_the_code_report_an_issue_or_help_improve_the_platform"
      ),
      href: "https://github.com/webbist-js/libraries.global",
      kind: "ring",
    },
    {
      title: tStatic("about.methodology"),
      text: tStatic(
        "about.what_we_include_how_we_count_and_where_the_gaps_are"
      ),
      href: "/knowledge/data-api/how-we-count",
      kind: "steps",
    },
    {
      title: tStatic("about.data_and_attribution"),
      text: tStatic(
        "about.check_the_terms_for_reuse_datasets_and_photos_keep_their_own_credits"
      ),
      href: "/legal/data-licence",
      kind: "link",
    },
    {
      title: tStatic("about.built_by_contributors"),
      text: tStatic(
        "about.the_people_who_know_libraries_improve_the_record_support_never_buys_review_authority"
      ),
      href: "/community",
      kind: "cluster",
    },
  ] as const

  const [selected, setSelected] = useState<number | null>(null)
  const narrative = useChapterFocus(5, selected ?? 0)
  const choose = (index: number) => {
    setSelected(index)
    narrative?.set({ focus: index })
  }

  return (
    <ul className="about-open-links" data-about-scene="5">
      {PRINCIPLES.map((principle, index) => {
        const content = (
          <>
            <span
              className="about-principle-mark"
              data-kind={principle.kind}
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
            </span>
            <span className="about-principle-copy">
              <strong>{principle.title}</strong>
              <span>{principle.text}</span>
            </span>
            <ArrowUpRight size={21} aria-hidden="true" />
          </>
        )
        const interaction = {
          className: "about-open-link",
          "data-active": selected === index,
          onMouseEnter: () => choose(index),
          onMouseLeave: () => setSelected(null),
          onFocus: () => choose(index),
          onBlur: () => setSelected(null),
        }

        return (
          <li key={principle.title}>
            {principle.href.startsWith("https://") ? (
              <a href={principle.href} {...interaction}>
                {content}
              </a>
            ) : (
              <Link href={principle.href} {...interaction}>
                {content}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function ContributionNetwork() {
  const tStatic = useTranslations("staticUi")

  const narrative = useContext(NarrativeContext)
  const [growth, setGrowth] = useState(0)
  useEffect(() => {
    if (!narrative) return
    const syncGrowth = () => {
      if (Math.round(narrative.current.progress) === 6)
        setGrowth(narrative.current.growth)
    }
    syncGrowth()

    return narrative.subscribe(syncGrowth)
  }, [narrative])
  const choose = (value: number) => {
    setGrowth(value)
    narrative?.set({ growth: value })
  }

  return (
    <div className="about-network-control">
      <p className="about-interaction-label">
        {tStatic("about.one_contribution_connected")}
      </p>
      <p className="about-network-status" aria-live="polite" aria-atomic="true">
        {growth === 0
          ? tStatic("aboutControl.begin")
          : growth < 1
            ? tStatic("aboutControl.local")
            : tStatic("aboutControl.small")}
      </p>
      <div
        className="about-network-buttons"
        role="group"
        aria-label={tStatic("about.illustrate_a_growing_record")}
      >
        <button
          type="button"
          className="about-button"
          aria-pressed={growth === 0.5}
          onClick={() => choose(0.5)}
        >
          <Plus size={17} aria-hidden="true" /> {tStatic("about.add_a_point")}
        </button>
        <button
          type="button"
          className="about-button about-button-secondary"
          aria-pressed={growth === 1}
          onClick={() => choose(1)}
        >
          {tStatic("about.see_the_connections")}{" "}
          <ArrowUpRight size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="about-network-reset"
          aria-label={tStatic("about.reset_the_contribution_illustration")}
          onClick={() => choose(0)}
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
