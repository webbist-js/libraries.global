import { RecordProgress } from "@/components/library-editor/WizardStepNav"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/RecordProgress",
  component: RecordProgress,
  args: {
    progress: [
      { n: 1, required: true, done: true },
      { n: 2, required: true, done: true },
      { n: 3, required: false, done: false },
    ],
    improving: true,
    changedCount: 2,
  },
} satisfies Meta<typeof RecordProgress>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
