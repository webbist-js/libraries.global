import { FeatureGatePanel } from "@/components/ds/FeatureGatePanel"
import { KpiTile } from "@/components/ds/KpiTile"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/FeatureGatePanel",
  component: FeatureGatePanel,
  args: {
    badge: "Free staff workspace",
    title: "Manage your library’s staff",
    lead: "Set up a free staff workspace to invite colleagues and give them roles.",
    points: ["Invite colleagues", "Owner and Editor levels per library"],
    action: { href: "/staff/teams/new", label: "Create a free workspace" },
  },
} satisfies Meta<typeof FeatureGatePanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithSecondaryStep: Story = {
  args: { secondary: { href: "/staff/claim", label: "Claim a library" } },
}
export const WithPreview: Story = {
  args: { preview: <KpiTile label="Example views" value="—" ghost /> },
}
