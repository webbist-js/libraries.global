import { ArticleEditor } from "@/components/contribute/article-editor/ArticleEditor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { articleDraft } from "../../fixtures/public/editor"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/ArticleEditor",
  component: ArticleEditor,
  args: {
    kind: "knowledge",
    title: articleDraft.title,
    summary: articleDraft.summary,
    doc: articleDraft.doc,
    docKey: "storybook-article",
    onTitleChange: fn(),
    onSummaryChange: fn(),
    onDocChange: fn(),
    uploadImage: async () => ({
      id: 1,
      url: "/library-placeholder.svg",
      alt: "A library illustration",
    }),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <ArticleEditor
            {...live}
            onTitleChange={(title) => {
              live.onTitleChange(title)
              update({ title })
            }}
            onSummaryChange={(summary) => {
              live.onSummaryChange(summary)
              update({ summary })
            }}
            onDocChange={(doc) => {
              live.onDocChange(doc)
              update({ doc })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticleEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ReadOnly: Story = { args: { readOnly: true } }
export const Journal: Story = { args: { kind: "journal" } }
