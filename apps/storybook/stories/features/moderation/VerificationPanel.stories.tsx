import { VerificationPanel } from "@/components/moderation/VerificationPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/VerificationPanel",
  component: VerificationPanel,
  args: {
    fields: {
      sections: ["hours", "contact"],
      source: "https://example.invalid/library",
      inPerson: false,
    },
    review: { current: { name: "Northbridge Library" } },
  },
} satisfies Meta<typeof VerificationPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
