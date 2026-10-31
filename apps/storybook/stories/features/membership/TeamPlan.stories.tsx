import { TeamPlan } from "@/app/[locale]/(dashboard)/contribute/_components/membership/TeamPlan"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Membership/TeamPlan",
  component: TeamPlan,
  args: { expanded: false, onExpandedChange: fn(), current: false, teams: [] },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <ul className="m-0 list-none p-0">
            <TeamPlan
              {...args}
              onExpandedChange={(expanded) => {
                args.onExpandedChange(expanded)
                updateArgs({ expanded })
              }}
            />
          </ul>
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof TeamPlan>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
