import { ArticleBylineCard } from "@/components/contribute/article-editor/ArticleBylineCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/ArticleBylineCard",
  component: ArticleBylineCard,
  args: {
    byline: "Maya Shah",
    origin: "community",
    allowIndex: true,
    disabled: false,
    onChange: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <ArticleBylineCard
            {...live}
            onChange={(patch) => {
              live.onChange(patch)
              update({ ...patch })
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
} satisfies Meta<typeof ArticleBylineCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const IndexByline: Story = { args: { origin: "index" } }
export const ReadOnly: Story = { args: { disabled: true } }
