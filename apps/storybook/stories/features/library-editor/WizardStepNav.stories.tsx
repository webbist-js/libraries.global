import { WizardStepNav } from "@/components/library-editor/WizardStepNav"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/WizardStepNav",
  component: WizardStepNav,
  args: {
    currentStep: 3,
    progress: [
      { n: 1, required: true, done: true },
      { n: 2, required: true, done: true },
      { n: 3, required: false, done: false },
    ],
    onStepClick: fn(),
    findHref: "/libraries",
  },
} satisfies Meta<typeof WizardStepNav>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Mobile: Story = { args: { mobile: true } }
