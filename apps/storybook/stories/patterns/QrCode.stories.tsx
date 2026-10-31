import { QrCode } from "@/components/ds/QrCode"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/QrCode",
  component: QrCode,
  args: {
    value: "https://example.invalid/library",
    label: "Example library QR code",
    size: 176,
  },
} satisfies Meta<typeof QrCode>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
