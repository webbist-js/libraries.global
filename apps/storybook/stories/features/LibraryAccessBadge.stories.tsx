import { LibraryAccessBadge } from "@/components/staff/LibraryAccessBadge"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Staff/LibraryAccessBadge",
  component: LibraryAccessBadge,
  args: { status: "pending" },
  argTypes: {
    status: {
      control: "select",
      options: [
        "approved",
        "invited",
        "draft",
        "pending",
        "needs_info",
        "unknown",
      ],
    },
  },
} satisfies Meta<typeof LibraryAccessBadge>

export default meta
type Story = StoryObj<typeof meta>

export const AwaitingReview: Story = {}
export const Approved: Story = { args: { status: "approved" } }
export const Invitation: Story = { args: { status: "invited" } }
export const Draft: Story = {
  args: { status: "draft" },
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Library access: Draft claim")).toBeVisible()
    await expect(canvas.queryByText(/Awaiting review/)).not.toBeInTheDocument()
  },
}
export const MoreInformationNeeded: Story = { args: { status: "needs_info" } }
export const Unknown: Story = {
  args: { status: "unknown" },
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("Library access: Status unavailable")
    ).toBeVisible()
    await expect(
      canvas.queryByText(/Approved|Awaiting review/)
    ).not.toBeInTheDocument()
  },
}
export const NarrowFrench: Story = {
  args: { status: "needs_info" },
  globals: { locale: "fr" },
  decorators: [
    (Story) => (
      <div style={{ width: 220, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    const label = canvas.getByText(
      "Accès à la bibliothèque : Informations requises"
    )
    await expect(label).toBeVisible()
    await expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(220)
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth + 1
    )
  },
}
