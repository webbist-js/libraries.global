import { DriveTaskList } from "@/components/drives/DriveTaskList"
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
  title: "Features/Drives/DriveTaskList",
  component: DriveTaskList,
  args: {
    tasks: driveTasks,
    verb: "Check hours",
    selectedId: driveTasks[0]!.documentId,
    doneIds: new Set<string>(),
    loading: false,
    error: null,
    hasMore: false,
    near: false,
    query: "",
    onSearch: fn(),
    onNear: fn(),
    page: 1,
    pageSize: 10,
    total: 2,
    onPage: fn(),
    onSelect: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <DriveTaskList
            {...live}
            onSearch={(query) => {
              live.onSearch(query)
              update({ query })
            }}
            onPage={(page) => {
              live.onPage(page)
              update({ page })
            }}
            onSelect={(task) => {
              live.onSelect(task)
              update({ selectedId: task.documentId })
            }}
            onNear={(point) => {
              live.onNear(point)
              update({ near: Boolean(point) })
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
} satisfies Meta<typeof DriveTaskList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { tasks: [], total: 0 } }
export const Loading: Story = { args: { tasks: [], loading: true } }
export const Unavailable: Story = {
  args: { tasks: [], error: "The task list could not be loaded." },
}
