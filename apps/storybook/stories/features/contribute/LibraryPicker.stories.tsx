import { LibraryPicker } from "@/components/contribute/LibraryPicker"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/LibraryPicker",
  component: LibraryPicker,
  args: { selected: null, onSelect: fn(), publishedCount: 1200 },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <LibraryPicker
            {...live}
            onSelect={(selected) => {
              live.onSelect(selected)
              update({ selected })
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
} satisfies Meta<typeof LibraryPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
