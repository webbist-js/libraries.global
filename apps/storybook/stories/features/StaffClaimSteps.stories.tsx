import { StaffClaimSteps } from "@/components/staff/StaffClaimSteps"
import { StaffPanel } from "@/components/staff/StaffPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Staff/StaffClaimSteps",
  component: StaffClaimSteps,
  args: { layout: "horizontal" },
  argTypes: {
    layout: { control: "radio", options: ["horizontal", "vertical"] },
  },
  decorators: [
    (Story) => (
      <StaffPanel title="How claims work">
        <Story />
      </StaffPanel>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3)
  },
} satisfies Meta<typeof StaffClaimSteps>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {}
export const Vertical: Story = { args: { layout: "vertical" } }
export const NarrowCzech: Story = {
  globals: { locale: "cs" },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
}
