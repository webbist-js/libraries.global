import { GlobalNavLinks } from "@/components/global/GlobalNavLinks"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { navLinks } from "../../fixtures/public/navigation"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/GlobalNavLinks",
  component: GlobalNavLinks,
  args: { links: navLinks, align: "start" },
  decorators: [
    (Story) => (
      <div style={{ minWidth: 1100 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    viewport: { defaultViewport: "desktop" },
  },
} satisfies Meta<typeof GlobalNavLinks>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
