import { StaffShell } from "@/app/[locale]/(dashboard)/staff/[slug]/_components/StaffShell"
import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { DashboardFrame } from "@/components/dashboard/DashboardFrame"
import { DashboardNavigation } from "@/components/dashboard/DashboardNavigation"
import { MainContent } from "@/components/ds/MainContent"
import { Container } from "@/components/elementary/Container"
import { buildFooterNavigation } from "@/components/global/footer-navigation"
import { FooterNavigationProvider } from "@/components/global/FooterNavigationContext"
import { GLOBAL_NAVIGATION } from "@/components/global/global-navigation"
import { GlobalNavbarAuthSection } from "@/components/global/GlobalNavbarAuthSection"
import { SiteSearchMount } from "@/components/global/SiteSearch"
import { NotificationProvider } from "@/components/notifications/NotificationProvider"
import { ProfileDrawerMount } from "@/components/profile/ProfileDrawerMount"
import { StaffNotices } from "@/components/staff/StaffNotices"
import { StaffWorkspace } from "@/components/staff/StaffWorkspace"
import type { StaffOverview } from "@/lib/staff/types"
import type { LibraryNotice } from "@repo/shared-data"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import type { FixtureSession } from "../../../.storybook/FixtureSession"
import { footerData, legalDocuments } from "../../fixtures/public/homepage"
import {
  readerSession,
  profileResponses,
} from "../../fixtures/workspace/profile"
import { staffLibrary, staffResponses } from "../../fixtures/workspace/staff"

const staffSession = {
  ...readerSession,
  user: {
    ...readerSession.user,
    capabilities: ["staff.area"],
    staffLibraries: [staffLibrary],
    claimedLibraryIds: [staffLibrary.id],
  },
} satisfies NonNullable<FixtureSession>
const activeNotice: LibraryNotice = {
  id: "active-notice",
  type: "service",
  scope: "library",
  scopeWeek: null,
  scopeDay: null,
  stopId: null,
  reason: null,
  endedAt: null,
  from: "2026-11-12",
  to: "2026-11-20",
  message:
    "The first-floor study area is closed for refurbishment. Quiet study spaces are available on the ground floor.",
}
const pastNotice: LibraryNotice = {
  ...activeNotice,
  id: "past-notice",
  type: "closure",
  from: "2026-10-19",
  to: "2026-10-20",
  endedAt: "2026-10-20T17:00:00Z",
  message:
    "Closed for essential maintenance. Online services and renewals remain available.",
}
const olderNotice: LibraryNotice = {
  ...activeNotice,
  id: "older-notice",
  from: "2025-12-22",
  to: "2026-01-02",
  message:
    "Our book return is available throughout the holiday period. Please leave returned items in the drop box by the main entrance.",
}
const overview: StaffOverview = {
  ...staffResponses["GET /api/staff/example-library/overview"].body,
  role: staffLibrary.role,
  counts: { suggestions: 3, noticesUpcoming: 0, noticesActive: 1 },
}
const navigationLabels = {
  atlas: "Atlas",
  find_libraries: "Find libraries",
  library_networks: "Library networks",
  community: "Community",
  journal: "Journal",
  knowledge: "Knowledge",
  api: "API",
}

const meta = {
  title: "Features/Staff/StaffNotices",
  component: StaffNotices,
  args: {
    id: "example-library",
    mobile: false,
    initial: {
      data: [],
      today: "2026-11-14",
      timezone: "Europe/London",
      stops: [],
      cycleWeeks: 1,
    },
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof StaffNotices>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The production staff layouts composed with a synthetic verified account. */
export const FullPage: Story = {
  args: {
    initial: {
      ...meta.args.initial,
      data: [activeNotice, pastNotice, olderNotice],
    },
  },
  parameters: {
    fixtureSession: staffSession,
    fixtureResponses: {
      ...staffResponses,
      ...profileResponses,
      "GET /api/staff/example-library/overview": { body: overview },
      "GET /api/drives/featured": { body: { data: null } },
      "GET /api/contribute/standing": { body: null },
      "POST /api/staff/example-library/notices": {
        body: {
          notice: {
            ...activeNotice,
            id: "new-notice",
            type: "closure",
            from: "2026-11-14",
            to: null,
            message: "Closed for maintenance today.",
          },
        },
      },
      "PATCH /api/staff/example-library/notices/active-notice": {
        body: { notice: activeNotice },
      },
      "POST /api/staff/example-library/notices/active-notice/end": {
        body: { notice: { ...activeNotice, endedAt: "2026-11-14T12:00:00Z" } },
      },
      "POST /api/staff/example-library/notices/past-notice/reactivate": {
        body: {
          notice: {
            ...pastNotice,
            from: "2026-11-14",
            to: null,
            endedAt: null,
          },
        },
      },
      "POST /api/staff/example-library/notices/older-notice/reactivate": {
        body: {
          notice: {
            ...olderNotice,
            from: "2026-11-14",
            to: null,
            endedAt: null,
          },
        },
      },
    },
    nextjs: { navigation: { pathname: "/staff/northbridge/notices" } },
    layout: "fullscreen",
    docs: { story: { inline: false, height: "1000px" } },
  },
  decorators: [
    (Story) => (
      <ContactModalProvider>
        <NotificationProvider>
          <FooterNavigationProvider
            navigation={buildFooterNavigation(footerData, legalDocuments, {
              legal: "Legal and policies",
              plans: "Plans and pricing",
            })}
          >
            <DashboardFrame
              navigation={
                <DashboardNavigation
                  links={GLOBAL_NAVIGATION.map((link) => ({
                    ...link,
                    label: navigationLabels[link.label],
                  }))}
                  auth={
                    <GlobalNavbarAuthSection
                      sessionSSR={staffSession}
                      presentation="dashboard"
                    />
                  }
                />
              }
            >
              <MainContent className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-clip">
                <StaffWorkspace
                  libraries={[staffLibrary]}
                  userId={staffSession.user.id}
                  adding={false}
                  guideHref="/knowledge/staff"
                >
                  <StaffShell
                    overview={overview}
                    libraries={[staffLibrary]}
                    meta={{
                      operatorName: "Example Library Service",
                      homeLibrary: null,
                    }}
                    plan="free"
                    teamCovered={false}
                  />
                  <Container className="py-8 sm:py-12">
                    <Story />
                  </Container>
                </StaffWorkspace>
              </MainContent>
            </DashboardFrame>
            <ProfileDrawerMount />
            <SiteSearchMount />
          </FooterNavigationProvider>
        </NotificationProvider>
      </ContactModalProvider>
    ),
  ],
}
