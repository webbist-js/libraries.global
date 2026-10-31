import { BetaFeedback } from "@/components/beta/BetaFeedback"
import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { DashboardFrame } from "@/components/dashboard/DashboardFrame"
import { DashboardNavigation } from "@/components/dashboard/DashboardNavigation"
import { buildFooterNavigation } from "@/components/global/footer-navigation"
import { FooterNavigationProvider } from "@/components/global/FooterNavigationContext"
import { GLOBAL_NAVIGATION } from "@/components/global/global-navigation"
import { GlobalNavbarAuthSection } from "@/components/global/GlobalNavbarAuthSection"
import { FindLibraryPage } from "@/components/index-page/FindLibraryPage"
import { NotificationProvider } from "@/components/notifications/NotificationProvider"
import { ProfileDrawerMount } from "@/components/profile/ProfileDrawerMount"
import { CookieConsent } from "@/components/providers/CookieConsent"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { findResult } from "../../fixtures/public/find"
import { footerData, legalDocuments } from "../../fixtures/public/homepage"
import {
  readerSession,
  profileResponses,
} from "../../fixtures/workspace/profile"

const labels = {
  atlas: "Atlas",
  find_libraries: "Find libraries",
  library_networks: "Library networks",
  community: "Community",
  journal: "Journal",
  knowledge: "Knowledge",
  api: "API",
}
const meta = {
  title: "Features/Dashboard/DashboardNavigation",
  component: DashboardNavigation,
  args: {
    links: GLOBAL_NAVIGATION.map((link) => ({
      ...link,
      label: labels[link.label],
    })),
    auth: (
      <GlobalNavbarAuthSection
        sessionSSR={readerSession}
        presentation="dashboard"
      />
    ),
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: {
      ...profileResponses,
      "GET /api/drives/featured": { body: { data: null } },
      "GET /api/contribute/standing": { body: null },
    },
    nextjs: { navigation: { pathname: "/libraries" } },
    layout: "fullscreen",
    docs: { story: { inline: false, height: "900px" } },
  },
  decorators: [
    (Story, context) => (
      <ContactModalProvider>
        <NotificationProvider>
          <FooterNavigationProvider
            navigation={buildFooterNavigation(footerData, legalDocuments, {
              legal: "Legal and policies",
              plans: "Plans and pricing",
            })}
          >
            <DashboardFrame navigation={<Story />}>
              <main className="dashboard-main">
                {context.parameters.withoutContentToolbar ? (
                  <div className="p-8">
                    <h1 className="type-h1">Libraries Global</h1>
                    <p>
                      Navigation and feedback stay available without a content
                      toolbar.
                    </p>
                  </div>
                ) : (
                  <FindLibraryPage
                    initial={findResult}
                    statsTotal={1200}
                    drives={[]}
                  />
                )}
              </main>
            </DashboardFrame>
            <CookieConsent locale="en" />
            <BetaFeedback label="Feedback" />
            <ProfileDrawerMount />
          </FooterNavigationProvider>
        </NotificationProvider>
      </ContactModalProvider>
    ),
  ],
} satisfies Meta<typeof DashboardNavigation>

export default meta
type Story = StoryObj<typeof meta>

export const SignedIn: Story = {}
export const SignedOut: Story = {
  args: {
    auth: (
      <GlobalNavbarAuthSection sessionSSR={null} presentation="dashboard" />
    ),
  },
  parameters: { fixtureSession: null },
}

export const WithoutContentToolbar: Story = {
  parameters: {
    withoutContentToolbar: true,
    nextjs: { navigation: { pathname: "/" } },
  },
}
