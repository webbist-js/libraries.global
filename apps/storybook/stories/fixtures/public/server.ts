import type { ArticleHistoryPage } from "@/lib/strapi-api/content/server"

import { aboutCountryRecord } from "./about"
import { journalLanding, discovery, blogArticle } from "./articles"
import { suggestions, suggestion } from "./community"
import {
  drive,
  driveView,
  driveTasks,
  driveHelpers,
  driveCorrectionRecord,
} from "./drives"
import { existingArticle } from "./editor"
import {
  homepageData,
  globeMarkers,
  homepageStats,
  homepageContinents,
  featuredLibraries,
  incompleteLibraries,
  footerData,
  legalDocuments,
  homepageDrives,
  homepageJournal,
} from "./homepage"
import {
  wikiArticle,
  wikiArticles,
  knowledgeSections,
  articleHistory,
} from "./knowledge"
import {
  networkList,
  networkDetail,
  networkWorkspace,
  affiliation,
} from "./networks"
import { mySubmissions, supporterDirectory } from "./routes"
import type { FixtureResponses } from "../../../.storybook/fixture-responses"

export const publicServerFixtures = {
  "search.fetchUpcomingEvents": [],
  "search.fetchGlobeMarkers": globeMarkers,
  "content.fetchHomepage": { data: homepageData },
  "content.fetchHomepagePillars": featuredLibraries,
  "content.fetchHomepageContinents": { data: homepageContinents },
  "content.fetchHomepageStats": homepageStats,
  "content.fetchFooter": { data: footerData },
  "content.fetchLegalDocuments": { data: legalDocuments },
  "content.fetchIncompleteLibraries": incompleteLibraries,
  "content.fetchArticleHistory": {
    data: articleHistory,
    meta: { page: 1, pageSize: 20, total: articleHistory.length },
  } satisfies ArticleHistoryPage,
  "content.fetchBlogArticle": { data: blogArticle },
  "content.fetchDocsWikiArticles": { data: wikiArticles },
  "content.fetchWikiArticle": { data: wikiArticle },
  "content.fetchWikiSections": {
    data: knowledgeSections.map((s) => ({
      documentId: s.documentId,
      name: s.title,
      slug: s.slug,
      description: s.description,
      order: s.order,
    })),
  },
  "journal.loadJournalTopStories": homepageJournal,
  "journal.loadJournalLanding": journalLanding,
  "journal.fetchMostReadJournalArticles": [],
  "drives.fetchHomepageDriveViews": homepageDrives,
  "drives.loadDriveView": driveView,
  "drives.fetchDriveView": driveView,
  "driveRecords.fetchDrive": drive,
  "driveRecords.fetchDriveTasks": {
    items: driveTasks,
    total: driveTasks.length,
    page: 1,
    pageSize: 20,
  },
  "driveRecords.fetchDriveLeaderboard": driveHelpers,
  "networks.publicNetworkList": networkList,
  "networks.publicNetworkDetail": networkDetail,
  "networks.readPublicNetwork": { affiliations: [affiliation] },
}
export const libraryHit = {
  id: 1,
  documentId: "example-library",
  name: "Northbridge Community Library",
  slug: "northbridge",
  libraryType: "Public",
  operationalStatus: "open",
  city: "Northbridge",
  continent_slug: "europe",
  country_slug: "example-country",
  region_slug: "northbridge",
  heroImage: { url: "/library-placeholder.svg" },
  _geo: { lat: 51.5, lng: -0.1 },
  featured: true,
  globeCell: "51,-1",
}
const meiliBody = {
  hits: [libraryHit],
  estimatedTotalHits: 1,
  totalHits: 1,
  totalPages: 1,
  page: 1,
  hitsPerPage: 20,
  limit: 20,
  offset: 0,
  processingTimeMs: 1,
  query: "",
  facetDistribution: { globeCell: { "51,-1": 1 }, libraryType: { Public: 1 } },
  facetStats: {},
}

export const publicResponses: FixtureResponses = {
  "POST /api/submissions/upload-image": {
    body: { id: 1, url: "/library-placeholder.svg" },
  },
  "GET /api/drives/featured": {
    body: {
      data: {
        title: drive.title,
        slug: drive.slug,
        progress: { done: 28, total: 50, percent: 56, unit: "library" },
      },
    },
  },
  "GET /api/relations/accessibility": {
    body: {
      data: [{ documentId: "example-step-free", name: "Step-free entrance" }],
    },
  },
  "GET /api/relations/amenities": {
    body: {
      data: [{ documentId: "example-reading-room", name: "Reading room" }],
    },
  },
  "GET /api/relations/services": {
    body: { data: [{ documentId: "example-printing", name: "Printing" }] },
  },
  "GET /api/contribute/library/northbridge": {
    body: { data: driveCorrectionRecord },
  },
  "GET /api/contribute/library/northbridge-archive": {
    body: {
      data: {
        ...driveCorrectionRecord,
        documentId: "example-archive",
        name: "Northbridge Local History Archive",
      },
    },
  },
  "GET /api/contribute/standing": {
    body: {
      data: {
        totalPoints: 72,
        tier: {
          name: "Contributor",
          nextName: "Archivist",
          nextThreshold: 100,
        },
      },
      pendingCount: 1,
      pendingLimit: 5,
    },
  },
  "GET /api/drives/opening-hours-for-every-library/mine": {
    body: { data: { sent: 3, inReview: 1, accepted: 2 } },
  },
  "POST /api/drives/opening-hours-for-every-library/next": {
    body: { data: driveTasks[0] },
  },
  "POST /api/drives/opening-hours-for-every-library/holds": {
    body: { data: { heldUntil: "2099-01-20T12:20:00Z" } },
  },
  "DELETE /api/drives/opening-hours-for-every-library/holds/example-library": {
    status: 204,
  },
  "DELETE /api/drives/opening-hours-for-every-library/holds/example-archive": {
    status: 204,
  },
  "GET /api/about/countries/united-kingdom": {
    body: { data: aboutCountryRecord },
  },
  "GET /api/about/countries/france": { body: { data: aboutCountryRecord } },
  "GET /api/public-proxy/api/blog-articles/browse": { body: discovery },
  "GET /api/public-proxy/api/wiki-articles/browse": {
    body: { ...discovery, items: wikiArticles },
  },
  "GET /api/relations/locales": {
    body: {
      data: [
        { code: "en", name: "English" },
        { code: "fr", name: "French" },
        { code: "de", name: "German" },
      ],
    },
  },
  "POST /api/option-suggestions/example-suggestion/vote": {
    body: { data: { voted: true, votes: 25 } },
  },
  "GET /api/profile/me/follow": { body: { following: false } },
  "POST /api/profile/me/follow": { body: { following: true } },
  "GET /api/discussions/threads": { body: { data: [], meta: { total: 0 } } },
  "GET /api/discussions/subjects": { body: { data: [], meta: { total: 0 } } },
  "GET /api/submissions/my": { body: { data: mySubmissions } },
  "GET /api/submissions/draft/wiki_edit": { body: { data: null } },
  "GET /api/submissions/draft/blog_submission": { body: { data: null } },
  "POST /api/submissions": {
    body: { data: { ...mySubmissions[0], documentId: "example-draft" } },
  },
  "PATCH /api/submissions/example-draft/draft": {
    body: { data: mySubmissions[0] },
  },
  "POST /api/submissions/example-draft/finalize": {
    body: { data: { ...mySubmissions[0], status: "pending" } },
  },
  "POST /api/submissions/example-draft/withdraw": {
    body: { data: { ...mySubmissions[0], status: "draft" } },
  },
  "GET /api/contribute/article": { body: { data: existingArticle } },
  "GET /api/contribute/journal-ownership": {
    body: {
      data: {
        eligibility: {
          "welcoming-a-new-reader": true,
          "a-reading-room-for-everyone": true,
        },
      },
    },
  },
  "GET /api/search/libraries": {
    body: {
      data: [
        {
          slug: "northbridge-library",
          name: "Northbridge Library",
          city: "Northbridge",
        },
      ],
    },
  },
  "GET /api/relations/wiki-sections": {
    body: {
      data: [
        {
          documentId: "example-knowledge-section",
          slug: "getting-started",
          name: "Getting started",
        },
      ],
    },
  },
  "GET /api/relations/blog-sections": {
    body: {
      data: [
        {
          documentId: "example-blog-section",
          slug: "library-stories",
          name: "Library stories",
        },
      ],
    },
  },
  "GET /api/relations/topics": {
    body: {
      data: [
        {
          documentId: "example-topic",
          slug: "accessibility",
          name: "Accessibility",
        },
      ],
    },
  },
  "GET /api/discussions/my/records": { body: { data: [], meta: { total: 0 } } },
  "GET /api/supporters": { body: { data: supporterDirectory } },
  "GET /api/staff/example-library/overview": {
    body: {
      counts: { suggestions: 3, noticesActive: 1 },
      library: { completeness: 82 },
    },
  },
  "POST /api/search/indexes/library/search": { body: meiliBody },
  "POST /api/search/indexes/library/facet-search": {
    body: {
      facetHits: [{ value: "Northbridge", count: 1 }],
      processingTimeMs: 1,
    },
  },
  "POST /api/search/indexes/event/search": {
    body: {
      ...meiliBody,
      hits: [],
      totalHits: 0,
      totalPages: 0,
      estimatedTotalHits: 0,
    },
  },
  "POST /api/search/indexes/blog-article/search": {
    body: { ...meiliBody, hits: discovery.items },
  },
  "POST /api/search/indexes/wiki-article/search": {
    body: { ...meiliBody, hits: wikiArticles },
  },
  "PUT /api/networks/example-network/affiliation": { body: affiliation },
  "POST /api/networks/example-affiliation/withdraw": { body: { ok: true } },
  "POST /api/networks/example-mandate/retry": { body: { ok: true } },
  "POST /api/networks/example-mandate/reconcile": { body: { ok: true } },
  "PUT /api/staff/team/example-team": { body: { ok: true } },
  "GET /api/networks": { body: networkList },
  "GET /api/networks/me": { body: networkWorkspace },
  "GET /api/networks/example-network": { body: networkDetail },
  "GET /api/networks/example-network/scope": {
    body: { libraryIds: ["example-library"] },
  },
  "POST /api/networks/example-network/claims": {
    body: { documentId: "example-request", status: "pending" },
  },
  "GET /api/drives/opening-hours-for-every-library/tasks": {
    body: {
      data: driveTasks,
      total: 2,
      page: 1,
      pageSize: 20,
      hasMore: false,
    },
  },
  "GET /api/drives/opening-hours-for-every-library/stats": {
    body: { inReview: 4, helpers: 12, credits: 84 },
  },
  "GET /api/option-suggestions": { body: { data: suggestions } },
  "POST /api/option-suggestions": { body: { data: suggestion } },
  "PATCH /api/profile/me": { body: { ok: true } },
  "POST /api/contact": { body: { ok: true } },
}
