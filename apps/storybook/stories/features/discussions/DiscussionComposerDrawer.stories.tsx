import { DashboardFrame } from "@/components/dashboard/DashboardFrame"
import { DashboardNavigation } from "@/components/dashboard/DashboardNavigation"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { DiscussionComposerDrawer } from "@/components/discussions/DiscussionComposerDrawer"
import { GLOBAL_NAVIGATION } from "@/components/global/global-navigation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import {
  context,
  discussionResponses,
  readerSession,
  subject,
  thread,
} from "../../fixtures/workspace/discussions"

const pending = { ...thread, state: "pending" as const }
const labels = {
  atlas: "Atlas",
  find_libraries: "Find libraries",
  library_networks: "Networks",
  community: "Community",
  journal: "Journal",
  knowledge: "Knowledge",
  api: "API",
}
const meta = {
  title: "Features/Discussions/DiscussionComposerDrawer",
  component: DiscussionComposerDrawer,
  args: {
    open: false,
    onClose: fn(),
    onSubmitted: fn(),
    signedIn: true,
    lockLanguage: false,
    subject,
    target: context.target,
    contextTitle: context.projection.title,
    languages: [
      { code: "en", name: "English" },
      { code: "cy", name: "Welsh" },
    ],
  },
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/community/discussions" } },
    fixtureSession: readerSession,
    fixtureResponses: {
      ...discussionResponses,
      "POST /api/discussions/threads": { body: { thread: pending } },
    },
    docs: { story: { inline: false, height: "900px" } },
  },
  render: function DrawerStory(args) {
    const [open, setOpen] = useState(args.open)

    return (
      <DashboardFrame
        navigation={
          <DashboardNavigation
            auth={null}
            links={GLOBAL_NAVIGATION.map((link) => ({
              ...link,
              label: labels[link.label],
            }))}
          />
        }
      >
        <main className="dashboard-main p-6">
          <RecordToolbar
            items={[
              { label: "Community", href: "/community" },
              { label: "Discussions" },
            ]}
          />
          <h1 className="type-h1">Conversations</h1>
          <button type="button" onClick={() => setOpen(true)}>
            Start a discussion
          </button>
          <DiscussionComposerDrawer
            {...args}
            open={open}
            onClose={() => {
              setOpen(false)
              args.onClose()
            }}
          />
        </main>
      </DashboardFrame>
    )
  },
} satisfies Meta<typeof DiscussionComposerDrawer>

export default meta
type Story = StoryObj<typeof meta>

const openEditor = async (element: HTMLElement) => {
  await userEvent.click(
    within(element).getByRole("button", { name: "Start a discussion" })
  )
  const dialog = await within(element.ownerDocument.body).findByRole("dialog", {
    name: "Start a discussion",
  })
  await expect(dialog).toHaveAttribute("data-drawer-panel", "left")
  await expect(dialog).toHaveAttribute("data-drawer-edge", "true")

  return within(dialog)
}

export const Library: Story = {
  play: async ({ canvasElement }) => {
    const editor = await openEditor(canvasElement)
    await expect(
      await editor.findByRole("textbox", { name: "Discussion title" })
    ).toBeVisible()
    await expect(
      await editor.findByRole("textbox", { name: "Message" })
    ).toBeVisible()
    await expect(
      editor.getByRole("button", { name: "Send for review" })
    ).toBeDisabled()
  },
}
export const Dark: Story = { ...Library, globals: { appearance: "dark" } }
export const Writing: Story = {
  args: {
    initialTitle: "Making libraries welcoming for new readers",
    initialBody:
      "What has helped people feel at home on their first visit?\n\nWe have been trying a short welcome tour. I would love to hear what has worked in other libraries.",
  },
  play: async ({ canvasElement }) => {
    const editor = await openEditor(canvasElement)
    await expect(
      await editor.findByRole("textbox", { name: "Message" })
    ).toHaveTextContent("What has helped people")
    await expect(
      editor.getByRole("button", { name: "Send for review" })
    ).toBeEnabled()
  },
}
export const WritingDark: Story = {
  ...Writing,
  globals: { appearance: "dark" },
}
export const Journal: Story = {
  ...Library,
  args: {
    lockLanguage: true,
    subject: { ...subject, slug: "journal", name: "Journal" },
    target: {
      uid: "api::blog-article.blog-article",
      documentId: "example-story",
      locale: "en",
    },
    contextTitle: "A library at the heart of its town",
    initialTitle: "Discussion: A library at the heart of its town",
  },
}
export const Knowledge: Story = {
  ...Library,
  args: {
    lockLanguage: true,
    subject: { ...subject, slug: "knowledge", name: "Knowledge" },
    target: {
      uid: "api::wiki-article.wiki-article",
      documentId: "example-guide",
      locale: "en",
    },
    contextTitle: "Planning an accessible visit",
  },
}
export const DraftAndPreview: Story = {
  play: async ({ canvasElement }) => {
    const editor = await openEditor(canvasElement)
    await userEvent.type(
      editor.getByRole("textbox", { name: "Discussion title" }),
      "A question about opening hours"
    )
    const message = await editor.findByRole("textbox", { name: "Message" })
    await userEvent.type(message, "What has helped your library?")
    await userEvent.type(message, " I would love to hear your experience.")
    await userEvent.click(editor.getByRole("button", { name: "Preview" }))
    await expect(editor.getByLabelText("Preview")).toHaveTextContent(
      "What has helped your library?"
    )
    await userEvent.click(editor.getByRole("button", { name: "Write" }))
    await userEvent.click(editor.getByRole("button", { name: "Cancel" }))
    await waitFor(() =>
      expect(
        within(canvasElement).getByRole("button", {
          name: "Start a discussion",
        })
      ).toHaveFocus()
    )
    const reopened = await openEditor(canvasElement)
    await expect(
      reopened.getByRole("textbox", { name: "Discussion title" })
    ).toHaveValue("A question about opening hours")
    await expect(
      await reopened.findByRole("textbox", { name: "Message" })
    ).toHaveTextContent("I would love to hear your experience.")
  },
}
export const SendForReview: Story = {
  play: async ({ canvasElement, args }) => {
    const editor = await openEditor(canvasElement)
    await userEvent.type(
      editor.getByRole("textbox", { name: "Discussion title" }),
      "Welcoming new readers"
    )
    await userEvent.type(
      await editor.findByRole("textbox", { name: "Message" }),
      "What has worked well at your library?"
    )
    await userEvent.click(
      editor.getByRole("button", { name: "Send for review" })
    )
    await waitFor(() => expect(args.onSubmitted).toHaveBeenCalledWith(pending))
    await waitFor(() => expect(args.onClose).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        within(canvasElement).getByRole("button", {
          name: "Start a discussion",
        })
      ).toHaveFocus()
    )
  },
}
export const SendFailure: Story = {
  parameters: {
    fixtureResponses: {
      ...discussionResponses,
      "POST /api/discussions/threads": {
        status: 503,
        body: { error: "Unavailable" },
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editor = await openEditor(canvasElement)
    await userEvent.type(
      editor.getByRole("textbox", { name: "Discussion title" }),
      "Keep my question"
    )
    await userEvent.type(
      await editor.findByRole("textbox", { name: "Message" }),
      "Keep my message too"
    )
    await userEvent.click(
      editor.getByRole("button", { name: "Send for review" })
    )
    await expect(await editor.findByRole("alert")).toBeVisible()
    await expect(
      editor.getByRole("textbox", { name: "Message" })
    ).toHaveTextContent("Keep my message too")
    await expect(args.onSubmitted).not.toHaveBeenCalled()
  },
}
export const SendingKeepsDrawerOpen: Story = {
  parameters: {
    fixtureResponses: {
      ...discussionResponses,
      "POST /api/discussions/threads": {
        delayMs: 700,
        body: { thread: pending },
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editor = await openEditor(canvasElement)
    await userEvent.type(
      editor.getByRole("textbox", { name: "Discussion title" }),
      "A question"
    )
    await userEvent.type(
      await editor.findByRole("textbox", { name: "Message" }),
      "Keep sending this message"
    )
    await userEvent.click(
      editor.getByRole("button", { name: "Send for review" })
    )
    await userEvent.click(editor.getByRole("button", { name: "Close" }))
    await expect(
      editor.getByRole("textbox", { name: "Discussion title" })
    ).toBeVisible()
    await waitFor(() => expect(args.onSubmitted).toHaveBeenCalledWith(pending))
    await waitFor(() =>
      expect(
        within(canvasElement).getByRole("button", {
          name: "Start a discussion",
        })
      ).toHaveFocus()
    )
  },
}
export const SignedOut: Story = {
  args: { signedIn: false },
  play: async ({ canvasElement }) => {
    const editor = await openEditor(canvasElement)
    const signIn = editor.getByRole("link", { name: /Sign in/ })
    await expect(signIn).toBeVisible()
    const returnPath = new URL(
      signIn.getAttribute("href")!,
      "https://example.org"
    ).searchParams.get("callbackUrl")!
    await expect(returnPath).toContain(
      "composeDiscussion=api%3A%3Alibrary.library%3Aexample-library"
    )
  },
}
export const Restricted: Story = {
  args: {
    disabled: true,
    disabledMessage: "Only moderators can start a discussion in this subject.",
  },
  play: async ({ canvasElement }) => {
    const editor = await openEditor(canvasElement)
    await expect(editor.getByRole("status")).toHaveTextContent(
      "Only moderators"
    )
    await expect(
      editor.queryByRole("textbox", { name: "Message" })
    ).not.toBeInTheDocument()
  },
}
