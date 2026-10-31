import { Emphasis } from "@/components/home/Emphasis"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/Emphasis",
  component: Emphasis,
  args: { text: "Stories from *libraries*" },
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
} satisfies Meta<typeof Emphasis>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
