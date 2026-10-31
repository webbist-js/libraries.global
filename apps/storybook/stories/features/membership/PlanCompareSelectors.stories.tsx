import { PlanCompareSelectors } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanCompareMobile"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Membership/PlanCompareSelectors",
  component: PlanCompareSelectors,
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, update) => (
          <PlanCompareSelectors
            {...args}
            onSelected={(selected) => {
              args.onSelected(selected)
              update({ selected })
            }}
            onBaseline={(baseline) => {
              args.onBaseline(baseline)
              update({ baseline })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  args: {
    selected: "pro",
    baseline: "free",
    onSelected: fn(),
    onBaseline: fn(),
  },
} satisfies Meta<typeof PlanCompareSelectors>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
