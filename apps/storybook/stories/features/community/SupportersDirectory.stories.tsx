import { SupportersDirectory } from "@/app/[locale]/(dashboard)/community/supporters/_components/SupportersDirectory"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { supporterDirectory } from "../../fixtures/public/routes"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/SupportersDirectory",
  component: SupportersDirectory,
  args: { data: supporterDirectory, query: {}, locale: "en" },
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
    },
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof SupportersDirectory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  args: {
    data: {
      ...supporterDirectory,
      entries: [],
      newThisMonth: [],
      total: 0,
      listed: 0,
      matched: 0,
    },
  },
}
export const Unavailable: Story = { args: { data: null } }
