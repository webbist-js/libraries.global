import { LegalPrintButton } from "@/components/legal/LegalPrintButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Legal/LegalPrintButton",
  component: LegalPrintButton,
  args: {},
} satisfies Meta<typeof LegalPrintButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
