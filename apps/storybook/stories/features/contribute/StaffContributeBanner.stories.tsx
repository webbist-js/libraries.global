import { StaffContributeBanner } from "@/app/[locale]/(dashboard)/contribute/_components/StaffContributeBanner"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/StaffContributeBanner",
  component: StaffContributeBanner,
  args: {
    libraries: [
      {
        id: "example-library",
        slug: "northbridge-library",
        name: "Northbridge Library",
        libraryType: "public",
      },
    ],
    userId: "storybook-reader",
    initialMetrics: { suggestions: 3, noticesActive: 1, completeness: 82 },
  },
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
} satisfies Meta<typeof StaffContributeBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SeveralLibraries: Story = {
  args: {
    libraries: [
      {
        id: "example-library",
        slug: "northbridge-library",
        name: "Northbridge Library",
        libraryType: "public",
      },
      {
        id: "example-second-library",
        slug: "riverside-library",
        name: "Riverside Library",
        libraryType: "academic",
      },
    ],
    initialMetrics: null,
  },
}
