import { ModeratedTag } from "@/components/library-editor/WizardFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/ModeratedTag",
  component: ModeratedTag,
  args: {},
} satisfies Meta<typeof ModeratedTag>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
