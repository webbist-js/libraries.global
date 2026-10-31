import { NetworkClaimReview } from "@/components/moderation/NetworkClaimReview"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/NetworkClaimReview",
  component: NetworkClaimReview,
  args: { documentId: "example-network-claim", status: "pending" },
} satisfies Meta<typeof NetworkClaimReview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
