import { CheckoutPlanPicker } from "@/components/billing/CheckoutPresentation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  priceCatalogue,
  billingResponses,
} from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Billing/CheckoutPlanPicker",
  component: CheckoutPlanPicker,
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, update) => (
          <CheckoutPlanPicker
            {...args}
            onPlan={(plan) => {
              args.onPlan(plan)
              update({ plan })
            }}
            onInterval={(interval) => {
              args.onInterval(interval)
              update({ interval })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  args: {
    catalogue: priceCatalogue,
    plan: "pro",
    interval: "month",
    onPlan: fn(),
    onInterval: fn(),
  },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof CheckoutPlanPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Annual: Story = { args: { interval: "year" } }
