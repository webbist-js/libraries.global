import { DiscussionFeed } from "@/components/discussions/DiscussionFeed"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  context,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionFeed",
  component: DiscussionFeed,
  args: { target: context.target, title: "Library conversations" },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof DiscussionFeed>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
export const AllLibraries: Story = {
  args: { target: undefined, contextType: "libraries" },
}

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
