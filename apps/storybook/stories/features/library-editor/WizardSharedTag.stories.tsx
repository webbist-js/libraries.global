import { SharedTag } from "@/components/library-editor/WizardFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/SharedTag",
  component: SharedTag,
  args: {},
} satisfies Meta<typeof SharedTag>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
