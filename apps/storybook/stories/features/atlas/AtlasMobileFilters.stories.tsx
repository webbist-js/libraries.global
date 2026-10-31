import { AtlasMobileFilters } from "@/components/atlas/AtlasMobileStops"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { expect, fn, userEvent, within } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasMobileFilters",
  component: AtlasMobileFilters,
  args: { value: "any", onChange: fn(), total: 24 },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AtlasMobileFilters
            {...args}
            onChange={(value) => {
              args.onChange(value)
              updateArgs({ value })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof AtlasMobileFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("radio", { name: "Today" }))
    await expect(args.onChange).toHaveBeenLastCalledWith("today")
    await expect(canvas.getByText(/scheduled visit today/)).toBeVisible()
  },
}
