import { TagsCard } from "@/components/contribute/article-editor/ArticleSidebar"
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
  title: "Features/Contribute/TagsCard",
  component: TagsCard,
  args: { tags: articleDraft.tags, locale: "en", onChange: fn() },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <TagsCard
            {...live}
            onChange={(tags) => {
              live.onChange(tags)
              update({ tags })
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
} satisfies Meta<typeof TagsCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { tags: [] } }
