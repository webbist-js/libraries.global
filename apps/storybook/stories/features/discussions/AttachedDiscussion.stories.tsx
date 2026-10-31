import { AttachedDiscussion } from "@/components/discussions/AttachedDiscussion"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  context,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/AttachedDiscussion",
  component: AttachedDiscussion,
  args: {
    target: context.target,
    subjectSlug: "library-life",
    title: "A library conversation",
    language: "en",
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof AttachedDiscussion>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Article: Story = { args: { presentation: "article" } }

export const JournalStart: Story = {
  args: {
    presentation: "article",
    subjectSlug: "journal",
    title: "A library story",
    target: {
      uid: "api::blog-article.blog-article",
      documentId: "example-story",
      locale: "en",
    },
  },
  parameters: {
    fixtureResponses: {
      ...discussionResponses,
      "GET /api/discussions/threads": { body: { data: [] } },
      "GET /api/discussions/subjects": {
        body: {
          data: [
            {
              id: "example-journal",
              slug: "journal",
              name: "Journal",
              visibility: "public",
              createPolicy: "members",
            },
          ],
        },
      },
    },
  },
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
    await expect(
      within(dialog).getByRole("textbox", { name: "Discussion title" })
    ).toHaveValue("Discussion: A library story")
    await expect(
      await within(dialog).findByRole("textbox", { name: "Message" })
    ).toBeVisible()
  },
}
export const KnowledgeStart: Story = {
  ...JournalStart,
  args: {
    presentation: "article",
    subjectSlug: "knowledge",
    title: "A library story",
    target: {
      uid: "api::wiki-article.wiki-article",
      documentId: "example-guide",
      locale: "en",
    },
  },
  parameters: {
    fixtureResponses: {
      ...discussionResponses,
      "GET /api/discussions/threads": { body: { data: [] } },
      "GET /api/discussions/subjects": {
        body: {
          data: [
            {
              id: "example-knowledge",
              slug: "knowledge",
              name: "Knowledge",
              visibility: "public",
              createPolicy: "members",
            },
          ],
        },
      },
    },
  },
}
