import { AccessChip } from "@/components/atlas/atlas-ui"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Atlas/AccessChip",
  component: AccessChip,
  args: { children: "Sign in" },
} satisfies Meta<typeof AccessChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Contributor: Story = {
  args: { children: "Contributor", locked: false, soft: true },
}
