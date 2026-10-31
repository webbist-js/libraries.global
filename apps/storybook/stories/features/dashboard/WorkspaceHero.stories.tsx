import { WorkspaceHero } from "@/components/dashboard/WorkspaceHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Dashboard/WorkspaceHero",
  component: WorkspaceHero,
  args: {
    title: "Your library workspace",
    eyebrow: "Staff area",
    lead: "Keep your public record accurate and welcoming.",
    breadcrumb: [
      { label: "Staff area", href: "/staff" },
      { label: "Northbridge Library" },
    ],
  },
  parameters: { docs: { story: { inline: false, height: "900px" } } },
} satisfies Meta<typeof WorkspaceHero>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
