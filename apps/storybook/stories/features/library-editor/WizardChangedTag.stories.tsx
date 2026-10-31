import { ChangedTag } from "@/components/library-editor/WizardFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/ChangedTag",
  component: ChangedTag,
  args: {},
} satisfies Meta<typeof ChangedTag>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
