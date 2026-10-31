import { HomeFooter } from "@/components/home/HomeFooter"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { footerData, legalDocuments } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/HomeFooter",
  component: HomeFooter,
  args: { footer: footerData, legalDocuments },
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
} satisfies Meta<typeof HomeFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
