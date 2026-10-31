import { CountryCombobox } from "@/components/settings/CountryCombobox"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Settings/CountryCombobox",
  component: CountryCombobox,
  args: {
    value: "GB",
    onChange: fn(),
    countries: [
      { code: "GB", name: "United Kingdom" },
      { code: "FR", name: "France" },
      { code: "CZ", name: "Czechia" },
    ],
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <CountryCombobox
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
} satisfies Meta<typeof CountryCombobox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unselected: Story = { args: { value: "" } }
