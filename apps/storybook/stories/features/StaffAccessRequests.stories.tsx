import { StaffAccessRequests } from "@/components/staff/StaffAccessRequests"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

import { staffAccessRequests } from "../fixtures/staff"

const meta = {
  title: "Features/Staff/StaffAccessRequests",
  component: StaffAccessRequests,
  args: { requests: staffAccessRequests, unavailable: false },
  argTypes: {
    requests: { control: "object" },
    unavailable: { control: "boolean" },
  },
} satisfies Meta<typeof StaffAccessRequests>

export default meta
type Story = StoryObj<typeof meta>

export const RecordedClaims: Story = {
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("Library access: Awaiting review")
    ).toBeVisible()
    await expect(canvas.getByText("Library access: Draft claim")).toBeVisible()
    await expect(
      canvas.getByText("Library access: More information needed")
    ).toBeVisible()
    await expect(
      canvas.getByRole("link", { name: "View your access requests" })
    ).toHaveAttribute("href", "/contribute/submissions")
  },
}
export const Unavailable: Story = {
  args: { requests: [], unavailable: true },
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "couldn’t be refreshed"
    )
    await expect(canvas.queryByRole("list")).not.toBeInTheDocument()
    await expect(
      canvas.getByRole("link", { name: "View your access requests" })
    ).toBeVisible()
  },
}
export const NarrowFrenchLongName: Story = {
  args: {
    requests: [
      {
        documentId: "example-long-claim",
        status: "needs_info",
        targetLabel:
          "Example University Library, Special Collections and Community Research Centre",
      },
    ],
  },
  globals: { locale: "fr" },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const panel = canvasElement.querySelector("section")!
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1)
  },
}
