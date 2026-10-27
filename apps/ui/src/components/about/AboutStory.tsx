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

import type { AboutLibrary } from "@/components/about/about.types"
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
import StatsStrip from "@/components/home/sections/StatsStrip"
import { tintForLibraryType } from "@/lib/design-tokens"

const LIBRARY_TYPES = [
  {
    title: "Public libraries",
    type: "Public",
    Icon: LibraryBig,
    text: "Local branches and municipal libraries that serve their communities.",
  },
  {
    title: "University & academic",
    type: "Academic",
    Icon: GraduationCap,
    text: "Libraries for teaching, study and research, with information about who can visit.",
  },
  {
    title: "National & parliamentary",
    type: "National",
    Icon: Landmark,
    text: "Institutions that preserve a country's publications, and libraries that support parliamentary work.",
  },
  {
    title: "Archives & specialist",
    type: "Special",
    Icon: Archive,
    text: "Cultural collections, archives and libraries devoted to a subject or profession.",
  },
  {
    title: "Monastic libraries",
    type: "Monastic",
    Icon: BookOpen,
    text: "Collections cared for by religious communities, including access by appointment.",
  },
  {
    title: "Mobile libraries",
    type: "Mobile",
    Icon: Bus,
    text: "Library services that bring books and resources to places without a nearby branch.",
  },
] as const

const RECORD_STEPS = [
  {
    title: "Start with a source",
    text: "A record starts with a published dataset or a public reference. Its source, publisher credits and licence details stay attached.",
  },
  {
    title: "Add local knowledge",
    text: "Contributors add opening hours, access rules, collection details and photographs. Links to public sources help reviewers check the information.",
  },
  {
    title: "Review and maintain",
    text: "Reviewers check community contributions before they are published. Accepted changes keep their history. Approved library staff can update their own records.",
  },
] as const

const PRINCIPLES = [
  {
    title: "Open source",
    Icon: Code2,
    text: "Read the code, report an issue or help improve the platform.",
    href: "https://github.com/webbist-js/libraries.global",
    action: "View the source code",
  },
  {
    title: "Sources and attribution",
    Icon: FileCheck2,
    text: "Records keep their sources. Data and photographs carry their own credits and licence information.",
    href: "/legal/data-licence",
    action: "Read the data licence",
  },
  {
    title: "A transparent method",
    Icon: ShieldCheck,
    text: "Our guides explain which institutions we include, how we count them and where information is missing.",
    href: "/knowledge/data-api/how-we-count",
    action: "How we count",
  },
  {
    title: "Independent and shared",
    Icon: HeartHandshake,
    text: "Contributors improve the records. Financial support pays for running the project; it does not buy inclusion or control over reviews.",
    href: "/community",
    action: "Meet the community",
  },
] as const

export function AboutStory({
  stats,
  continents,
  libraries,
}: {
  readonly stats: HomepageStats | null
  readonly continents: HomepageContinentSummary[]
  readonly libraries: readonly AboutLibrary[]
}) {
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
              <p className="about-eyebrow">Our purpose</p>
              <SectionHeader
                id="about-purpose-title"
                intro={{ title: "Why this index *exists.*" }}
              />
            </div>
            <div className="about-prose">
              <p>
                A library&apos;s address is only part of what a visitor needs.
                Opening hours, access rules and information about collections
                can be harder to find.
              </p>
              <p>
                Libraries Global is an independent project that brings those
                details together in an open index, organised by geography. You
                can look for a nearby branch or explore collections further
                afield.
              </p>
              <p>
                Library staff can maintain their institution&apos;s record.
                Researchers can compare what has been documented, and
                contributors can add details they know or find in public
                sources.
              </p>
              <GlobalLink href="/libraries" className="about-text-link">
                Find a library{" "}
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
          <p className="about-eyebrow">What we include</p>
          <SectionHeader
            id="about-types-title"
            intro={{
              title: "The libraries *we include.*",
              text: "We include libraries and archives that collect, preserve or provide access to recorded knowledge. Some are open to everyone. Others admit members, researchers or visitors by appointment. Records explain these access conditions.",
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
          <p className="about-eyebrow">How records are built</p>
          <SectionHeader
            id="about-process-title"
            intro={{
              title: "Sources, contributions *and review.*",
              text: "Records develop over time as sources are checked and people add what they know.",
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
            Read the contribution guides{" "}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </GlobalLink>
        </Container>
      </section>

      <section
        id="where-we-are"
        className="about-section about-coverage"
        aria-labelledby="about-coverage-title"
      >
        <Container>
          <p className="about-eyebrow">Current coverage</p>
          <SectionHeader
            id="about-coverage-title"
            intro={{
              title: "What we have *recorded so far.*",
              text: "These counts come from published records. Coverage varies between countries, and the index is still incomplete. The figures show what we have documented, not how many libraries exist worldwide.",
            }}
            textBeside
          />
          {stats ? (
            <div className="about-stats-panel">
              <StatsStrip stats={stats} />
            </div>
          ) : (
            <p className="about-data-note">
              Live counts are unavailable at the moment. You can still browse
              the index and explore the atlas.
            </p>
          )}
        </Container>
        {continents.length > 0 ? (
          <div className="about-coverage-rows">
            <CoverageSection
              continents={continents}
              countryBreakdown={countryBreakdown}
              intro={{
                title: "By continent",
                text: "Each bar shows how the continent's published records are distributed between countries.",
              }}
            />
          </div>
        ) : null}
        <Container>
          <p className="about-data-note">
            Help fill a gap by adding a library or improving a record in an area
            you know.
          </p>
          <GlobalLink href="/map" className="about-text-link">
            Explore coverage in the atlas{" "}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </GlobalLink>
        </Container>
      </section>

      <section
        id="open-by-design"
        className="about-section about-principles"
        aria-labelledby="about-open-title"
      >
        <Container>
          <p className="about-eyebrow">Project principles</p>
          <SectionHeader
            id="about-open-title"
            intro={{
              title: "Open to read, *open to improve.*",
              text: "Library records are free to browse. The source code is public, and our guides explain how contributions are reviewed and how data can be reused.",
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
              title: "Help document *a library you know.*",
              text: "Add a missing library, correct its opening hours or share a photograph you took. A free account lets you submit changes and keep track of accepted contributions.",
              primaryLabel: "Add a library",
              primaryHref: "/contribute/index/new",
              secondaryLabel: "Ways to contribute",
              secondaryHref: "/contribute",
            }}
            benefits={[
              {
                title: "Add what is missing",
                text: "A library, its opening hours or its access details.",
              },
              {
                title: "Share a photograph",
                text: "Help people recognise a place before they visit.",
              },
              {
                title: "Keep your library current",
                text: "Library staff can claim and maintain their record.",
              },
            ]}
          />
          <div className="about-contribute-links">
            <div className="about-contribute-option">
              <p className="about-eyebrow">For library staff</p>
              <GlobalLink href="/contribute/claim" className="about-text-link">
                Represent your library{" "}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </GlobalLink>
              <p>
                Claim your institution&apos;s record and keep its details
                current.
              </p>
            </div>
            <div className="about-contribute-option">
              <p className="about-eyebrow">Questions or ideas?</p>
              <GlobalLink
                href="mailto:info@libraries.global"
                className="about-text-link"
              >
                Get in touch{" "}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </GlobalLink>
              <p>
                Tell us about a dataset, a missing library or an idea for the
                project.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </div>
  )
}
