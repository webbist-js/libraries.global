import { BarSeries } from "@/components/ds/BarSeries"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Patterns/BarSeries",
  component: BarSeries,
  args: {
    title: "Record views",
    points: [
      { date: "2026-01-12", value: 12 },
      { date: "2026-01-13", value: 20 },
      { date: "2026-01-14", value: 8 },
      { date: "2026-01-15", value: 24 },
    ],
    highlightLast: false,
  },
} satisfies Meta<typeof BarSeries>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Highlight: Story = { args: { highlightLast: true } }
export const Empty: Story = {
  args: { points: [], emptyMessage: "No views in this period" },
}
export const Preview: Story = { args: { ghost: true } }
export const AccessibleTable: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Show daily table" })
    )
    await expect(canvas.getByRole("table")).toBeVisible()
    await expect(
      canvas.getByRole("columnheader", { name: "Views" })
    ).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Show chart" }))
    await expect(canvas.getByRole("img")).toBeVisible()
  },
}
