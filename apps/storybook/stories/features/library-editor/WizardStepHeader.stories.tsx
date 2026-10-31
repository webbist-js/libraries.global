import { StepHeader } from "@/components/library-editor/WizardFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/StepHeader",
  component: StepHeader,
  args: {
    n: 1,
    label: "Identity",
    title: "Introduce the library",
    sub: "Add the library name and type.",
  },
} satisfies Meta<typeof StepHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
