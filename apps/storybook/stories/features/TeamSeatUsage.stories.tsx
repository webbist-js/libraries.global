import { TeamSeatUsage } from "@/components/staff/TeamSeatUsage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Staff/TeamSeatUsage",
  component: TeamSeatUsage,
  args: { used: 1, total: 5 },
  argTypes: {
    used: { control: { type: "number", min: 0 } },
    total: { control: { type: "number", min: 0 } },
  },
} satisfies Meta<typeof TeamSeatUsage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Full: Story = { args: { used: 5 } }
export const Empty: Story = { args: { used: 0 } }
export const OverCapacity: Story = {
  args: { used: 6 },
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("6 of 5 seats used")).toBeVisible()
    const progress = canvas.getByRole("progressbar", {
      name: "Team seats in use",
    }) as HTMLProgressElement
    await expect(progress.value).toBeLessThanOrEqual(progress.max)
  },
}
