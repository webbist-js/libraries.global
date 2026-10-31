import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { GlobalNavbarAuthSection } from "@/components/global/GlobalNavbarAuthSection"
import { SiteSearchMount } from "@/components/global/SiteSearch"
import { NotificationProvider } from "@/components/notifications/NotificationProvider"
import { ProfileDrawerMount } from "@/components/profile/ProfileDrawerMount"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { contributorSession } from "../../fixtures/public/session"
import { profileResponses } from "../../fixtures/workspace/profile"

const meta = {
  decorators: [
    (Story) => (
      <ContactModalProvider>
        <NotificationProvider>
          <Story />
          <ProfileDrawerMount />
          <SiteSearchMount />
        </NotificationProvider>
      </ContactModalProvider>
    ),
  ],
  title: "Features/Global/GlobalNavbarAuthSection",
  component: GlobalNavbarAuthSection,
  args: { presentation: "menu" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: { ...publicResponses, ...profileResponses },
    docs: {
      story: { inline: false, iframeHeight: 800 },
      description: {
        component:
          "This example uses its own iframe to keep fixture transport and panel state independent. Open Canvas for interactive Controls.",
      },
    },
  },
} satisfies Meta<typeof GlobalNavbarAuthSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Dashboard: Story = { args: { presentation: "dashboard" } }

export const SignedIn: Story = {
  args: {
    sessionSSR: contributorSession,
    profileSnippet: { username: "example-reader", profileBackground: "violet" },
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: { ...publicResponses, ...profileResponses },
    fixtureSession: contributorSession,
  },
}
