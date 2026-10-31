import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { DashboardFrame } from "@/components/dashboard/DashboardFrame"
import { buildFooterNavigation } from "@/components/global/footer-navigation"
import { FooterNavigationProvider } from "@/components/global/FooterNavigationContext"
import { GlobalHeader } from "@/components/global/GlobalHeader"
import { SiteSearchMount } from "@/components/global/SiteSearch"
import { NotificationProvider } from "@/components/notifications/NotificationProvider"
import { ProfileDrawerMount } from "@/components/profile/ProfileDrawerMount"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { asyncStory } from "../../../.storybook/AsyncStory"
import { footerData, legalDocuments } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { profileResponses } from "../../fixtures/workspace/profile"

const meta = {
  decorators: [
    (Story, { args }) => (
      <ContactModalProvider>
        <NotificationProvider>
          {args.variant === "dashboard" ? (
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
                    The site header supplies the dashboard navigation in this
                    layout.
                  </p>
                </main>
              </DashboardFrame>
            </FooterNavigationProvider>
          ) : (
            <Story />
          )}
          <ProfileDrawerMount />
          <SiteSearchMount />
        </NotificationProvider>
      </ContactModalProvider>
    ),
  ],
  title: "Features/Global/GlobalHeader",
  component: GlobalHeader,
  render: asyncStory(GlobalHeader),
  args: { locale: "en", variant: "site" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: { ...publicResponses, ...profileResponses },
    react: { rsc: true },
    layout: "fullscreen",
    docs: {
      story: { inline: false, iframeHeight: 800 },
      description: {
        component:
          "The real asynchronous site header and its search, language, contribution and account panels. Open Canvas for Controls.",
      },
    },
  },
} satisfies Meta<typeof GlobalHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Application: Story = { args: { variant: "app" } }
export const Dashboard: Story = { args: { variant: "dashboard" } }
