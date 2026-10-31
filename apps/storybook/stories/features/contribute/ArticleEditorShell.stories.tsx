import { ArticleEditorShell } from "@/components/contribute/article-editor/ArticleEditorShell"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { editorLocales, existingArticle } from "../../fixtures/public/editor"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { editorSession } from "../../fixtures/public/session"

const meta = {
  title: "Features/Contribute/ArticleEditorShell",
  component: ArticleEditorShell,
  args: {
    kind: "knowledge",
    mode: "edit",
    article: existingArticle,
    locales: editorLocales,
    uiLocale: "en",
    canOwnEdit: true,
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
} satisfies Meta<typeof ArticleEditorShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NewArticle: Story = { args: { mode: "new", article: undefined } }
export const Journal: Story = { args: { kind: "journal" } }
