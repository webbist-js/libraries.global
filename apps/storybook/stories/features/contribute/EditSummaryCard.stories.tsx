import { EditSummaryCard } from "@/components/contribute/article-editor/ArticleSidebar"
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
  title: "Features/Contribute/EditSummaryCard",
  component: EditSummaryCard,
  args: { value: articleDraft.editSummary, onChange: fn() },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <EditSummaryCard
            {...live}
            onChange={(value) => {
              live.onChange(value)
              update({ value })
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
} satisfies Meta<typeof EditSummaryCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ReadOnly: Story = { args: { disabled: true } }
