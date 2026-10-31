import { AtlasContributeCard } from "@/components/atlas/AtlasContributeCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasContributeCard",
  component: AtlasContributeCard,
  args: { signedIn: false },
} satisfies Meta<typeof AtlasContributeCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedIn: Story = { args: { signedIn: true } }
