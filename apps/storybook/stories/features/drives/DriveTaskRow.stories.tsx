import { DriveTaskRow } from "@/components/drives/DriveTaskRow"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { driveTasks } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveTaskRow",
  component: DriveTaskRow,
  args: {
    task: driveTasks[0]!,
    verb: "Check hours",
    selected: false,
    inReview: false,
    onSelect: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <DriveTaskRow
            {...live}
            onSelect={(task) => {
              live.onSelect(task)
              update({ selected: true })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  decorators: [
    (Story) => (
      <ul className="m-0 list-none p-0">
        <Story />
      </ul>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveTaskRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Selected: Story = { args: { selected: true } }
export const Reviewing: Story = { args: { inReview: true } }
