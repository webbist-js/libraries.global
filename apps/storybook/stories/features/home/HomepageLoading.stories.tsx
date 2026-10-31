import { HomepageLoading } from "@/components/home/HomepageFrame"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/HomepageLoading",
  component: HomepageLoading,
  args: {},
  decorators: [
    (Story) => (
      <div data-homepage>
        <Story />
      </div>
    ),
  ],
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
    react: { rsc: true },
  },
} satisfies Meta<typeof HomepageLoading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
