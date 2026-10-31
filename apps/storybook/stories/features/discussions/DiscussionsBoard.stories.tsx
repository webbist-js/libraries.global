import { DiscussionsBoard } from "@/components/discussions/DiscussionsBoard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionsBoard",
  component: DiscussionsBoard,
  args: {
    languages: [
      { code: "en", name: "English" },
      { code: "cy", name: "Welsh" },
    ],
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof DiscussionsBoard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const StartDiscussion: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", {
        name: "Start a discussion",
      })
    )
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Start a discussion" }
    )
    await expect(dialog).toHaveAttribute("data-drawer-panel", "left")
    await expect(
      await within(dialog).findByRole("textbox", { name: "Message" })
    ).toBeVisible()
  },
}
