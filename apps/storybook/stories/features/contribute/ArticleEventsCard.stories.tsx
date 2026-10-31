import { ArticleEventsCard } from "@/components/contribute/article-editor/ArticleSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/ArticleEventsCard",
  component: ArticleEventsCard,
  args: {
    mentions: [
      {
        title: "Saturday reading circle",
        startTime: "2026-01-24T10:00:00Z",
        timezone: "Europe/London",
        libraryName: "Northbridge Library",
        url: "https://example.org/reading-circle",
      },
    ],
    libraries: [],
    onChange: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <ArticleEventsCard
            {...live}
            onChange={(mentions) => {
              live.onChange(mentions)
              update({ mentions })
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
} satisfies Meta<typeof ArticleEventsCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { mentions: [] } }
