import { DraftResumeBanner } from "@/components/library-editor/DraftResumeBanner"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/DraftResumeBanner",
  component: DraftResumeBanner,
  args: {
    savedStep: 3,
    savedAt: "2026-01-15T10:30:00Z",
    onResume: fn(),
    onDiscard: fn(),
  },
} satisfies Meta<typeof DraftResumeBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
