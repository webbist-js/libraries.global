"use client"

import { ArrowUpRight, Check, Plus, RotateCcw } from "lucide-react"
import Image from "next/image"
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

const CONTEXTS = [
  {
    title: "Reading",
    text: "A quiet desk. A first library card.",
    caption: "A place to sit down and begin.",
    kind: "room",
  },
  {
    title: "Research",
    text: "A question that leads into a collection.",
    caption: "Follow a question into a collection.",
    kind: "shelves",
  },
  {
    title: "Memory",
    text: "The records a community keeps.",
    caption: "The things a community chooses to keep.",
    kind: "archive",
  },
  {
    title: "Mobile",
    text: "A library that comes to you.",
    caption: "Sometimes the library comes to you.",
    kind: "mobile",
  },
] as const

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
      aria-label="What a library makes possible"
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
                  ? `${photograph.caption ?? photograph.alt}. ${photograph.story ?? "One of the libraries in our shared record."}`
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
                  ? (photograph.story ??
                    "One of the libraries in our shared record.")
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

const TYPES = [
  {
    title: "Public libraries",
    text: "The local branch, open to its community.",
    x: 17,
    y: 24,
    size: "clamp(40px,5.6vw,96px)",
  },
  {
    title: "University & academic",
    text: "Collections for study and research.",
    x: 68,
    y: 14,
    size: "clamp(28px,3.4vw,58px)",
  },
  {
    title: "National & parliamentary",
    text: "The records and collections of a country.",
    x: 79,
    y: 47,
    size: "clamp(30px,3.8vw,66px)",
  },
  {
    title: "Archives & cultural",
    text: "Manuscripts, memory and specialist knowledge.",
    x: 22,
    y: 60,
    size: "clamp(30px,4vw,70px)",
  },
  {
    title: "Monastic libraries",
    text: "Collections cared for across generations.",
    x: 52,
    y: 86,
    size: "clamp(26px,3vw,52px)",
  },
  {
    title: "Mobile libraries",
    text: "Library services that come to their communities.",
    x: 84,
    y: 82,
    size: "clamp(26px,3.2vw,56px)",
  },
] as const

export function LibraryTypes() {
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
        <span>One open index</span>
      </div>
      <div
        className="about-type-labels"
        role="group"
        aria-label="Kinds of library"
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
          Browse the index <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

const RECORD_STEPS = [
  {
    title: "Start with a source",
    text: "Published datasets and public references establish a record. Original provenance, publisher credits and licence details stay with it.",
  },
  {
    title: "Add what people know",
    text: "Library websites, photographs and local knowledge add useful details, with public sources to support them.",
  },
  {
    title: "Review, then keep the history",
    text: "Community contributions are checked before they appear. Accepted changes leave a history. Approved library staff can publish ordinary updates to their own records.",
  },
] as const

export function RecordSteps({ children }: { readonly children?: ReactNode }) {
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
          aria-label="How a library record develops"
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
          See how review works <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <div
        className="about-record-demo"
        data-about-scene="3"
        id="about-example-record"
      >
        <div className="about-record-grid" aria-hidden="true" />
        <div className="about-record-content">
          <p className="about-record-kicker">An illustrative record</p>
          <h3 className="type-h3">A library, better known.</h3>
          <div className="about-record-layers">
            <div className="about-record-layer" data-visible="true">
              <span className="about-record-field-label">The foundation</span>
              <p>Name, institution type and location</p>
              <small>A published source, with its credit and licence.</small>
            </div>
            <div
              className="about-record-layer"
              data-visible={step >= 1}
              aria-hidden={step < 1}
            >
              <span className="about-record-field-label">Local knowledge</span>
              <p>Hours, access details and a photograph</p>
              <small>Useful information, supported by public references.</small>
            </div>
            <div
              className="about-record-layer"
              data-visible={step >= 2}
              aria-hidden={step < 2}
            >
              <span className="about-record-field-label">
                <Check size={13} aria-hidden="true" /> Reviewed and credited
              </span>
              <p>A record with a history</p>
              <small>Accepted changes stay traceable to their sources.</small>
            </div>
          </div>
          <p
            className="about-record-status"
            aria-live="polite"
            aria-atomic="true"
          >
            Stage {step + 1} of 3 · {RECORD_STEPS[step]!.title}
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
}

const CONTINENT_POSITION: Readonly<Record<string, { x: number; y: number }>> = {
  europe: { x: 53.3, y: 22.2 },
  asia: { x: 75.6, y: 32.2 },
  africa: { x: 55.6, y: 47.8 },
  "north-america": { x: 23.1, y: 27.2 },
  "south-america": { x: 33.3, y: 58.3 },
  oceania: { x: 89.4, y: 65.6 },
}

export function CoverageExplorer({
  continents,
  locale = "en-GB",
}: {
  readonly continents: readonly HomepageContinentSummary[]
  readonly locale?: string
}) {
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
  const number = new Intl.NumberFormat(locale)
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
        aria-label="Published library records across the world"
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
              <strong>{number.format(continent.libraryCount)}</strong>
              <span className="sr-only"> records documented</span>
            </button>
          )
        })}
      </div>
      <div className="about-coverage-bottom">
        <div className="about-coverage-chart">
          <div className="about-coverage-controls">
            <p className="about-interaction-label">
              Published records by continent
            </p>
            <div
              className="about-scale-buttons"
              role="group"
              aria-label="Coverage bar scale"
            >
              <button
                type="button"
                aria-pressed={scale === "count"}
                onClick={() => setScale("count")}
              >
                Count
              </button>
              <button
                type="button"
                aria-pressed={scale === "log"}
                onClick={() => setScale("log")}
              >
                Log scale
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
                        {number.format(continent.libraryCount)}
                        <span className="sr-only"> published libraries</span>
                      </span>
                      <span className="about-coverage-share">
                        {shareLabel}
                        <span className="sr-only">
                          {" "}
                          of these continent records
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="about-coverage-note">
              Coverage counts are unavailable at the moment. You can still
              explore the atlas.
            </p>
          )}
        </div>
        <div
          className="about-coverage-detail"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="about-interaction-label">
            {current?.name ?? "A picture still forming"}
          </p>
          <p>
            {current
              ? `${number.format(current.libraryCount)} published ${current.libraryCount === 1 ? "record" : "records"} so far.`
              : "Choose a continent to see what we have documented."}
          </p>
          <span>
            Counts describe the index. They do not measure how many libraries
            exist in a place.
          </span>
          <Link
            href={current?.slug ? `/${current.slug}` : "/map"}
            className="about-text-link"
          >
            {current?.name ? `Explore ${current.name}` : "Explore the atlas"}{" "}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <p className="about-coverage-note">
        Log scale makes small counts easier to compare. Numbers and shares stay
        the same.
      </p>
    </div>
  )
}

const PRINCIPLES = [
  {
    title: "Source code",
    text: "Read the code, report an issue or help improve the platform.",
    href: "https://github.com/webbist-js/libraries.global",
    kind: "ring",
  },
  {
    title: "Methodology",
    text: "What we include, how we count, and where the gaps are.",
    href: "/knowledge/data-api/how-we-count",
    kind: "steps",
  },
  {
    title: "Data and attribution",
    text: "Check the terms for reuse. Datasets and photos keep their own credits.",
    href: "/legal/data-licence",
    kind: "link",
  },
  {
    title: "Built by contributors",
    text: "The people who know libraries improve the record. Support never buys review authority.",
    href: "/community",
    kind: "cluster",
  },
] as const

export function OpenPrinciples() {
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
      <p className="about-interaction-label">One contribution, connected.</p>
      <p className="about-network-status" aria-live="polite" aria-atomic="true">
        {growth === 0
          ? "It begins with one record."
          : growth < 1
            ? "Local knowledge adds to the picture."
            : "Small contributions build a shared record."}
      </p>
      <div
        className="about-network-buttons"
        role="group"
        aria-label="Illustrate a growing record"
      >
        <button
          type="button"
          className="about-button"
          aria-pressed={growth === 0.5}
          onClick={() => choose(0.5)}
        >
          <Plus size={17} aria-hidden="true" /> Add a point
        </button>
        <button
          type="button"
          className="about-button about-button-secondary"
          aria-pressed={growth === 1}
          onClick={() => choose(1)}
        >
          See the connections <ArrowUpRight size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="about-network-reset"
          aria-label="Reset the contribution illustration"
          onClick={() => choose(0)}
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
