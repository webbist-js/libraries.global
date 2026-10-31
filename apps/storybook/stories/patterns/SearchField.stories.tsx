import { SearchField } from "@/components/ds/SearchField"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId, type ComponentProps } from "react"
import { useArgs } from "storybook/preview-api"
import { fn, expect } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

function SearchExample(props: ComponentProps<typeof SearchField>) {
  const id = useId()

  return <SearchField {...props} id={`${props.id}-${id}`} />
}

const meta = {
  title: "Patterns/SearchField",
  component: SearchField,
  args: {
    id: "library-search",
    label: "Search libraries",
    placeholder: "Library name or town",
    loading: false,
    onClear: fn(),
    inputProps: { value: "" },
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <SearchExample
            {...args}
            inputProps={{
              ...args.inputProps,
              onChange: (e) =>
                updateArgs({
                  inputProps: { ...args.inputProps, value: e.target.value },
                }),
            }}
            onClear={() => {
              args.onClear?.()
              updateArgs({ inputProps: { ...args.inputProps, value: "" } })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof SearchField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Disabled: Story = {
  args: { inputProps: { value: "", disabled: true } },
}
export const SearchAndClear: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const field = canvas.getByRole("searchbox")
    await userEvent.type(field, "Northbridge")
    await expect(field).toHaveValue("Northbridge")
    await userEvent.click(canvas.getByRole("button", { name: "Clear search" }))
    await expect(field).toHaveValue("")
    await expect(args.onClear).toHaveBeenCalled()
  },
}
