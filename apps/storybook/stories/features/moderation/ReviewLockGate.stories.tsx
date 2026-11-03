import { ReviewLockGate } from "@/components/moderation/ReviewLockGate"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/ReviewLockGate",
  component: ReviewLockGate,
  args: {
    documentId: "example-submission",
    active: false,
    children: <button type="button">Approve submission</button>,
  },
} satisfies Meta<typeof ReviewLockGate>

export default meta
type Story = StoryObj<typeof meta>

export const CompletedSubmission: Story = {}
