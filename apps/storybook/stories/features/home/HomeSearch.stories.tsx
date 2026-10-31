import HomeSearch from "@/components/home/HomeSearch"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/HomeSearch",
  component: HomeSearch,
  args: {},
  decorators: [
    (Story) => (
      <div data-homepage>
        <Story />
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    docs: {
      story: { inline: false, iframeHeight: 800 },
      description: {
        component:
          "This example uses its own iframe to keep fixture transport and panel state independent. Open Canvas for interactive Controls.",
      },
    },
  },
} satisfies Meta<typeof HomeSearch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
