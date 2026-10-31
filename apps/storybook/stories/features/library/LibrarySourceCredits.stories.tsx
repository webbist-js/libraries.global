import { LibrarySourceCredits } from "@/components/library/LibrarySourceCredits"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibrarySourceCredits",
  component: LibrarySourceCredits,
  args: {
    references: [
      {
        url: "https://example.invalid/directory",
        label: "Example open directory",
        fields: ["name", "website"],
      },
    ],
    datasets: [],
    added: "2026-01-01T12:00:00Z",
    formatDate: (value) =>
      value ? new Date(value).toLocaleDateString("en-GB") : null,
  },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibrarySourceCredits>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
