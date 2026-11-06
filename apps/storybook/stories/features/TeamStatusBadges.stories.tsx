import { TeamStatusBadges } from "@/components/staff/TeamStatusBadges"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Staff/TeamStatusBadges",
  component: TeamStatusBadges,
  args: { workspace: "open", verified: false },
  argTypes: {
    workspace: {
      control: "select",
      options: [undefined, "open", "closed"],
    },
    verified: { control: "boolean" },
  },
} satisfies Meta<typeof TeamStatusBadges>

export default meta
type Story = StoryObj<typeof meta>

export const OpenUnverified: Story = {
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Workspace: Open")).toBeVisible()
    await expect(
      canvas.getByText("Team verification: Not verified")
    ).toBeVisible()
    await expect(canvas.queryByText(/Awaiting review/)).not.toBeInTheDocument()
  },
}
export const OpenVerified: Story = { args: { verified: true } }
export const ClosedVerified: Story = {
  args: { workspace: "closed", verified: true },
}
export const DetailsUnavailable: Story = {
  args: { workspace: undefined, verified: undefined },
  parameters: {
    docs: {
      description: {
        story:
          "Neither badge is rendered until its state is known. The parent workspace supplies refresh guidance; absence does not mean closed or unverified.",
      },
    },
  },
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByText(/Workspace:|Team verification:/)
    ).not.toBeInTheDocument()
  },
}
export const WorkspaceOnly: Story = { args: { verified: undefined } }
export const NarrowFrench: Story = {
  globals: { locale: "fr" },
  decorators: [
    (Story) => (
      <div style={{ width: 220, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll("span")
    for (const badge of badges)
      await expect(badge.getBoundingClientRect().width).toBeLessThanOrEqual(220)
  },
}
