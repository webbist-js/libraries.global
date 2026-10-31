import { SharedBlock } from "@/components/library-editor/WizardFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/SharedBlock",
  component: SharedBlock,
  args: {
    fields: ["name"],
    children: <p>This identity is shared across translations.</p>,
  },
} satisfies Meta<typeof SharedBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
