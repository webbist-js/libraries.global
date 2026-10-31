import { ReviewDecisionForm } from "@/components/moderation/ReviewDecisionForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/ReviewDecisionForm",
  component: ReviewDecisionForm,
  args: {
    documentId: "example-submission",
    status: "pending",
    canPublish: true,
  },
} satisfies Meta<typeof ReviewDecisionForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NeedsInformation: Story = { args: { status: "needs_info" } }
export const Decided: Story = {
  args: { status: "approved", canPublish: false },
}
