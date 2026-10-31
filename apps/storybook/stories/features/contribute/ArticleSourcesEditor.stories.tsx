import { ArticleSourcesEditor } from "@/components/contribute/article-editor/ArticleSourcesEditor"
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
  title: "Features/Contribute/ArticleSourcesEditor",
  component: ArticleSourcesEditor,
  args: { sources: articleDraft.sources ?? [], onChange: fn() },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <ArticleSourcesEditor
            {...live}
            onChange={(sources) => {
              live.onChange(sources)
              update({ sources })
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
} satisfies Meta<typeof ArticleSourcesEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { sources: [] } }
export const ReadOnly: Story = { args: { disabled: true } }
