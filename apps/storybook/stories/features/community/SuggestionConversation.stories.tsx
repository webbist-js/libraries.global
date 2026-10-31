import { SuggestionConversation } from "@/components/community/SuggestionConversation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { suggestion } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/SuggestionConversation",
  component: SuggestionConversation,
  args: {
    suggestion,
    expanded: false,
    mounted: true,
    onToggle: fn(),
    panelId: "example-suggestion-discussion",
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <SuggestionConversation
            {...live}
            onToggle={() => {
              live.onToggle()
              update({ expanded: !live.expanded })
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
} satisfies Meta<typeof SuggestionConversation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
