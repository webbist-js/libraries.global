import { RequiredTag } from "@/components/library-editor/WizardFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/RequiredTag",
  component: RequiredTag,
  args: {},
} satisfies Meta<typeof RequiredTag>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
