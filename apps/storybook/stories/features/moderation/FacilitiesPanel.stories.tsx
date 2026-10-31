import { FacilitiesPanel } from "@/components/moderation/FacilitiesPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/FacilitiesPanel",
  component: FacilitiesPanel,
  args: {
    fields: {
      accessibility: ["step_free"],
      services: ["wifi"],
      amenities: ["quiet_study"],
    },
  },
} satisfies Meta<typeof FacilitiesPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
