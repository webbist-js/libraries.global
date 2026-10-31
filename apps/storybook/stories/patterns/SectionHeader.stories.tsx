import { SectionHeader } from "@/components/ds/SectionHeader"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/SectionHeader",
  component: SectionHeader,
  args: { children: "Libraries", italic: "around the world", as: "h2" },
} satisfies Meta<typeof SectionHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Subsection: Story = { args: { as: "h3", italic: undefined } }
