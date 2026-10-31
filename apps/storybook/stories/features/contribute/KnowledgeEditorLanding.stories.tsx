import { KnowledgeEditorLanding } from "@/app/[locale]/(dashboard)/contribute/knowledge/_components/KnowledgeEditorLanding"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { editableArticles } from "../../fixtures/public/routes"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { editorSession } from "../../fixtures/public/session"

const meta = {
  title: "Features/Contribute/Routes/KnowledgeEditorLanding",
  component: KnowledgeEditorLanding,
  args: {
    articles: editableArticles,
    drafts: [
      {
        kind: "knowledge",
        documentId: "example-draft",
        title: "A welcome for every reader",
        targetSlug: null,
        updatedAt: "2026-01-20T12:00:00Z",
        locale: "en",
      },
    ],
    initialKind: "knowledge",
    kinds: ["knowledge", "journal"],
    initialTotal: 1,
  },
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
    },
    fixtureSession: editorSession,
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof KnowledgeEditorLanding>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  args: { articles: [], drafts: [], initialTotal: 0 },
}
export const Unavailable: Story = {
  args: { articles: [], drafts: [], initialFailed: true },
}
