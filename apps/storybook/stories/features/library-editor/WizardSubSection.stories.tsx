import { SubSection } from "@/components/library-editor/WizardFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/SubSection",
  component: SubSection,
  args: { label: "Contact details", sub: "Help visitors get in touch." },
} satisfies Meta<typeof SubSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
