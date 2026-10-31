import { DEFAULT_JOURNAL_QUERY } from "@/components/blog/journalLanding.helpers"
import type { JournalCardData, JournalLandingData } from "@/lib/journal-landing"
import type {
  BlogArticleDetail,
  ArticleBodyBlock,
} from "@/lib/strapi-api/content/server"
import type { ArticleBrowseResult } from "@repo/shared-data"

export const articleBody: ArticleBodyBlock[] = [
  {
    __component: "content.rich-text",
    id: 1,
    body: [
      {
        type: "paragraph",
        children: [
          {
            type: "text",
            text: "A welcoming library can make a lasting difference to its community.",
          },
        ],
      },
    ],
  },
  {
    __component: "content.quote-block",
    id: 2,
    quote: "The library gives us a place to learn together.",
    attribution: "Example contributor",
  },
  {
    __component: "content.callout",
    id: 3,
    type: "tip",
    title: "Plan a visit",
    body: "Check the opening hours and accessible entrance before travelling.",
  },
  {
    __component: "content.code-block",
    id: 4,
    language: "json",
    filename: "library.json",
    code: '{"name":"Northbridge Library","published":true}',
  },
  {
    __component: "content.image-block",
    id: 5,
    image: {
      url: "/library-placeholder.svg",
      alternativeText: "Synthetic library illustration",
      width: 640,
      height: 420,
    },
    caption: "An illustration used only by this pattern library.",
  },
]
export const articleSection = {
  documentId: "example-section",
  slug: "library-stories",
  name: "Library stories",
  icon: "mdi:bookshelf",
  tint: "purple",
  count: 6,
}
export const journalArticle: JournalCardData = {
  documentId: "example-article",
  locale: "en",
  title: "A reading room for everyone",
  slug: "a-reading-room-for-everyone",
  summary:
    "How a community library created more space for reading, conversation and local history.",
  author: "Maya S.",
  authorUsername: "example-maya",
  publicationOrigin: "community",
  publishedAt: "2026-01-15T12:00:00Z",
  updatedAt: "2026-01-16T12:00:00Z",
  featured: true,
  readingTimeMinutes: 5,
  readMinutes: 5,
  place: "Northbridge",
  section: articleSection,
  sectionSlugs: [articleSection.slug],
  heroImage: {
    url: "/library-placeholder.svg",
    alternativeText: "Synthetic library illustration",
  },
  facets: { topics: [{ value: "reading", label: "Reading spaces" }] },
  translations: [
    {
      locale: "fr",
      slug: "une-salle-pour-tous",
      title: "Une salle de lecture pour tous",
    },
  ],
}
export const articles: JournalCardData[] = [
  journalArticle,
  {
    ...journalArticle,
    documentId: "example-field-note",
    title: "The mobile library’s next stop",
    slug: "the-mobile-library-next-stop",
    featured: false,
    publicationOrigin: "index",
    readMinutes: 3,
    readingTimeMinutes: 3,
  },
  {
    ...journalArticle,
    documentId: "example-data",
    title: "New records in the library index",
    slug: "new-library-records",
    publicationOrigin: "index",
    entriesAdded: 1240,
  },
]
export const discovery: ArticleBrowseResult = {
  items: articles,
  total: articles.length,
  page: 1,
  pageSize: 9,
  pageCount: 1,
  editorialItems: articles.filter((a) => a.publicationOrigin === "index"),
  editorPick: journalArticle,
  appliedFilters: {},
  facets: {
    languages: [
      { value: "en", label: "English", count: 3 },
      { value: "fr", label: "Français", count: 1 },
    ],
    continents: [],
    countries: [],
    regions: [],
    areas: [],
    libraries: [],
    topics: [{ value: "reading", label: "Reading spaces", count: 3 }],
    authors: [{ value: "example-maya", label: "Maya S.", count: 3 }],
    events: [],
    origins: [
      { value: "community", label: "Community", count: 1 },
      { value: "index", label: "From the index", count: 2 },
    ],
    sections: [
      { value: articleSection.slug, label: articleSection.name, count: 3 },
    ],
  },
}
export const blogArticle: BlogArticleDetail = {
  ...journalArticle,
  body: articleBody,
  availableLocales: ["en", "fr"],
  topics: [{ documentId: "reading", name: "Reading spaces", slug: "reading" }],
  libraries: [
    {
      documentId: "example-library",
      name: "Northbridge Library",
      slug: "northbridge",
      continent: { slug: "europe" },
      country: { slug: "example-country" },
      region: { slug: "northbridge" },
    },
  ],
  authorProfile: {
    username: "example-maya",
    firstName: "Maya",
    lastName: "S.",
  },
  sources: [
    {
      title: "Example library annual report",
      url: "https://example.invalid/report",
      publisher: "Example Library Service",
      accessedAt: "2026-01-15",
      notes: null,
    },
  ],
}
export const journalLanding: JournalLandingData = {
  featured: journalArticle,
  editorsPick: true,
  sideStories: articles.slice(1),
  landing: {
    heroEyebrow: "The Journal",
    heroTitle: "Stories from libraries",
    heroText: "Ideas and field notes from the library community.",
  },
  query: DEFAULT_JOURNAL_QUERY,
  lang: "en",
  linkLocale: "en",
  fallbackFrom: null,
  languages: [
    { code: "en", name: "English" },
    { code: "fr", name: "Français" },
  ],
  sections: [articleSection],
  total: articles.length,
  list: { items: articles, total: articles.length, page: 1, pageCount: 1 },
  mostRead: [],
  discovery,
  communityPick: journalArticle,
  fieldNotes: [journalArticle],
  dataDrops: [articles[2]!],
  dataDropsTotal: 1,
}
