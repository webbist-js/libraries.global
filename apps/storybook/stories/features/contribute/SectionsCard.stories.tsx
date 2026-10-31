import { SectionsCard } from "@/components/contribute/article-editor/ArticleSidebar"
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
  title: "Features/Contribute/SectionsCard",
  component: SectionsCard,
  args: {
    kind: "knowledge",
    locale: "en",
    sections: articleDraft.sections,
    onChange: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <SectionsCard
            {...live}
            onChange={(sections) => {
              live.onChange(sections)
              update({ sections })
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
} satisfies Meta<typeof SectionsCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Inherited: Story = { args: { inherited: true } }
