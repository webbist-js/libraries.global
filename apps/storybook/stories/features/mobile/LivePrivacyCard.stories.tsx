import { LivePrivacyCard } from "@/components/mobile/live/LivePrivacyCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/LivePrivacyCard",
  component: LivePrivacyCard,
  args: { libraryDocumentId: "example-mobile" },
} satisfies Meta<typeof LivePrivacyCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
