import { KpiTile } from "@/components/ds/KpiTile"
import { PlanGatePanel } from "@/components/ds/PlanGatePanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/PlanGatePanel",
  component: PlanGatePanel,
  args: {
    title: "Understand your library’s reach",
    lead: "View trends for your library service.",
    points: ["Record views over time", "Exportable reports"],
    compareHref: "/contribute/membership",
    contactHref: "mailto:example@example.invalid",
  },
} satisfies Meta<typeof PlanGatePanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ComingSoon: Story = { args: { comingSoon: true } }
export const WithPreview: Story = {
  args: { preview: <KpiTile label="Example views" value="—" ghost /> },
}
