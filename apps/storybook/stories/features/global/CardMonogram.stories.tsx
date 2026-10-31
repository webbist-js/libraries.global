import { CardMonogram } from "@/components/global/ContributeMenuParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/CardMonogram",
  component: CardMonogram,
  args: {
    icon: "mdi:book-open-page-variant-outline",
    tint: "accent",
    size: 40,
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-3">
        <Story />
        <span>Knowledge editor</span>
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof CardMonogram>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Library: Story = { args: { icon: "mdi:library", tint: "public" } }
