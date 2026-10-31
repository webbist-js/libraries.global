import {
  discussionReplyFlow,
  type DiscussionRecord,
} from "@/components/discussions/api"
import { DiscussionRecordCard } from "@/components/discussions/DiscussionRecordCard"
import { DiscussionReplyBranch } from "@/components/discussions/DiscussionReplyBranch"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"
import { expect, fn, userEvent, within, waitFor } from "storybook/test"

import { conversationReplies, openingMessage } from "../fixtures/discussions"

function scopedRecord(
  record: DiscussionRecord,
  scope: string
): DiscussionRecord {
  return {
    ...record,
    id: `${record.id}-${scope}`,
    parentId: record.parentId ? `${record.parentId}-${scope}` : undefined,
    threadId: record.threadId ? `${record.threadId}-${scope}` : undefined,
  }
}

const meta = {
  title: "Features/Discussions/Message",
  component: DiscussionRecordCard,
  render: function Example(args) {
    const scope = useId().replaceAll(/[^a-zA-Z0-9_-]/g, "")

    return (
      <DiscussionRecordCard
        {...args}
        record={scopedRecord(args.record, scope)}
      />
    )
  },
  args: {
    record: openingMessage,
    kind: "thread",
    layout: "conversation",
    number: 1,
    own: false,
    signedIn: true,
    canReply: true,
    canReact: true,
    onReload: fn(async () => {}),
    onReply: fn(),
    onQuote: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          "Production message cards and reply branches, using synthetic records. Reply and menu actions can be explored; service mutations are not connected in this presentation preview.",
      },
    },
  },
} satisfies Meta<typeof DiscussionRecordCard>

export default meta
type Story = StoryObj<typeof meta>

export const Opening: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Reply" }))
    await expect(args.onReply).toHaveBeenCalled()
  },
}

export const ThreadedConversation: Story = {
  render: function Example(args) {
    const scope = useId().replaceAll(/[^a-zA-Z0-9_-]/g, "")
    const replies = conversationReplies.map((record) =>
      scopedRecord(record, scope)
    )

    return (
      <div className="grid gap-4">
        <DiscussionRecordCard
          {...args}
          record={scopedRecord(args.record, scope)}
        />
        {discussionReplyFlow(replies, []).map(
          ({ record, depth, parent }, index) => (
            <DiscussionReplyBranch key={record.id} depth={depth}>
              <DiscussionRecordCard
                {...args}
                record={record}
                kind="reply"
                number={index + 2}
                canReply={!record.parentId}
                replyingTo={
                  record.parentId
                    ? { id: record.parentId, name: parent!.author!.name }
                    : undefined
                }
              />
            </DiscussionReplyBranch>
          )
        )}
      </div>
    )
  },
  play: async ({ canvas, canvasElement }) => {
    const branches = [
      ...canvasElement.querySelectorAll<HTMLElement>("[data-reply-depth]"),
    ]
    await expect(branches).toHaveLength(3)
    await expect(branches[1]!.getBoundingClientRect().left).toBeGreaterThan(
      branches[0]!.getBoundingClientRect().left
    )
    const parent = canvasElement.querySelector(
      'article[id*="example-stop-notices"]'
    )!
    await expect(
      canvas.getByRole("link", { name: "Reply to Ben T." })
    ).toHaveAttribute("href", `#${parent.id}`)
    const nested = canvasElement.querySelector(
      'article[id*="example-timetable"]'
    )!
    await expect(
      within(nested as HTMLElement).queryByRole("button", {
        name: "Reply",
      })
    ).not.toBeInTheDocument()
  },
}

export const NarrowFrench: Story = {
  ...ThreadedConversation,
  globals: { locale: "fr" },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    for (const card of canvasElement.querySelectorAll<HTMLElement>("article")) {
      await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1)
    }
  },
}

export const OwnMessage: Story = {
  args: { own: true },
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "More message actions" })
    )
    await waitFor(() =>
      expect(
        within(document.body).getByRole("button", { name: "Edit your message" })
      ).toBeVisible()
    )
    await expect(
      within(document.body).getByRole("button", { name: "Quote" })
    ).toBeVisible()
  },
}

export const PrivatePendingReply: Story = {
  args: {
    kind: "reply",
    own: true,
    record: {
      ...conversationReplies[0]!,
      state: "pending",
      body: "My proposed reply, waiting for review.",
    },
  },
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("Only you and moderators can see this.")
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "Copy link" })
    ).not.toBeInTheDocument()
  },
}

export const Removed: Story = {
  args: {
    record: {
      ...openingMessage,
      state: "removed",
      body: "Archived text must stay hidden",
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByText("Archived text must stay hidden")
    ).not.toBeInTheDocument()
  },
}

export const SignedOut: Story = { args: { signedIn: false } }
export const Suggestion: Story = { args: { layout: "suggestion" } }
