import { TimelineRow } from "@/components/library/LibraryChangeTimeline"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/TimelineRow",
  component: TimelineRow,
  args: {
    icon: "M12 8v4l3 3",
    tone: "ok",
    title: "Opening hours confirmed",
    meta: ["example-reader", "24 October 2026"],
    lead: "Checked against the official library website.",
  },
  decorators: [
    (Story) => (
      <ol className="m-0 list-none p-0">
        <Story />
      </ol>
    ),
  ],
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof TimelineRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Import: Story = {
  args: {
    tone: "import",
    title: "Library added",
    lead: "Imported from a published open directory.",
  },
}
