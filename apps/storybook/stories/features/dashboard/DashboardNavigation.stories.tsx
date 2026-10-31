import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { DashboardFrame } from "@/components/dashboard/DashboardFrame"
import { DashboardNavigation } from "@/components/dashboard/DashboardNavigation"
import { buildFooterNavigation } from "@/components/global/footer-navigation"
import { FooterNavigationProvider } from "@/components/global/FooterNavigationContext"
import { GLOBAL_NAVIGATION } from "@/components/global/global-navigation"
import { GlobalNavbarAuthSection } from "@/components/global/GlobalNavbarAuthSection"
import { NotificationProvider } from "@/components/notifications/NotificationProvider"
import { ProfileDrawerMount } from "@/components/profile/ProfileDrawerMount"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

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
    (Story) => (
      <ContactModalProvider>
        <NotificationProvider>
          <FooterNavigationProvider
            navigation={buildFooterNavigation(footerData, legalDocuments, {
              legal: "Legal and policies",
              plans: "Plans and pricing",
            })}
          >
            <DashboardFrame navigation={<Story />}>
              <main className="dashboard-main p-8">
                <h1 className="type-h1">Library workspace</h1>
                <p>
                  Use the rail, More menu and account controls to explore the
                  real navigation.
                </p>
              </main>
            </DashboardFrame>
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
