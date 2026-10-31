import { HomepageContentLoading } from "@/components/home/HomepageFrame"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/HomepageContentLoading",
  component: HomepageContentLoading,
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
  },
} satisfies Meta<typeof HomepageContentLoading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
