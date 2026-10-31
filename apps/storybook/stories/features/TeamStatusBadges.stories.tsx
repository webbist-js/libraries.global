import { TeamStatusBadges } from "@/components/staff/TeamStatusBadges"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Staff/TeamStatusBadges",
  component: TeamStatusBadges,
  args: { membership: "active", verified: false },
  argTypes: {
    membership: {
      control: "select",
      options: [undefined, "active", "lapsed", "expired"],
    },
    verified: { control: "boolean" },
  },
} satisfies Meta<typeof TeamStatusBadges>

export default meta
type Story = StoryObj<typeof meta>

export const ActiveUnverified: Story = {
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Team membership: Active")).toBeVisible()
    await expect(
      canvas.getByText("Team verification: Not verified")
    ).toBeVisible()
    await expect(canvas.queryByText(/Awaiting review/)).not.toBeInTheDocument()
  },
}
export const ActiveVerified: Story = { args: { verified: true } }
export const LapsedVerified: Story = {
  args: { membership: "lapsed", verified: true },
}
export const ExpiredUnverified: Story = { args: { membership: "expired" } }
export const DetailsUnavailable: Story = {
  args: { membership: undefined, verified: undefined },
  parameters: {
    docs: {
      description: {
        story:
          "Neither badge is rendered until its state is known. The parent workspace supplies refresh guidance; absence does not mean inactive or unverified.",
      },
    },
  },
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByText(/Team membership:|Team verification:/)
    ).not.toBeInTheDocument()
  },
}
export const MembershipOnly: Story = { args: { verified: undefined } }
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
