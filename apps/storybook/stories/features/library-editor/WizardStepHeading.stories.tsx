import { StepHeading } from "@/components/library-editor/WizardFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/StepHeading",
  component: StepHeading,
  args: {
    eyebrow: "Step 1",
    title: "Introduce the library",
    lead: "Start with its name, type and current status.",
  },
} satisfies Meta<typeof StepHeading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
