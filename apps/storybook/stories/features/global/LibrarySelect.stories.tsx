import { LibrarySelect } from "@/components/global/ContributeMenuParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/LibrarySelect",
  component: LibrarySelect,
  args: {
    library: {
      options: [
        { id: "example-library", name: "Northbridge Library" },
        { id: "example-archive", name: "Northbridge Archive" },
      ],
      selectedId: "example-library",
      select: fn(),
    },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <LibrarySelect
            {...live}
            library={{
              ...live.library,
              select: (selectedId) => {
                live.library.select(selectedId)
                update({ library: { ...live.library, selectedId } })
              },
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
} satisfies Meta<typeof LibrarySelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
