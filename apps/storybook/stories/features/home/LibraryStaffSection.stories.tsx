import { LibraryStaffSection } from "@/components/home/sections/LibraryStaffSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageContent } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/LibraryStaffSection",
  component: LibraryStaffSection,
  args: {
    band: homepageContent.libraryBand,
    tools: homepageContent.libraryTools,
  },
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
} satisfies Meta<typeof LibraryStaffSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
