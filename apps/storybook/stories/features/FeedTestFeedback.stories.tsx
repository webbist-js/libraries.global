import { FeedTestFeedback } from "@/components/event-feeds/FeedTestFeedback"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Event feeds/Test feedback",
  component: FeedTestFeedback,
  args: { error: null, result: "ok" },
} satisfies Meta<typeof FeedTestFeedback>

export default meta
type Story = StoryObj<typeof meta>

export const Connected: Story = {}
export const InvalidCredentials: Story = { args: { result: "auth_failed" } }
export const Unreachable: Story = { args: { result: "unreachable" } }
export const Idle: Story = { args: { result: null } }
export const RequestFailed: Story = {
  args: {
    result: null,
    error: "The test could not run. Check your connection.",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "The test could not run."
    )
    await expect(canvas.queryByText("Test result")).not.toBeInTheDocument()
  },
}
