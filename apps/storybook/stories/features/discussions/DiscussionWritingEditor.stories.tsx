import { DiscussionWritingEditor } from "@/components/discussions/DiscussionWritingEditor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { expect, fn, userEvent, within } from "storybook/test"

const meta = {
  title: "Features/Discussions/DiscussionWritingEditor",
  component: DiscussionWritingEditor,
  args: {
    value: "",
    onChange: fn(),
    disabled: false,
    describedBy: "writing-limit",
  },
  render: function EditorStory(args) {
    const [value, setValue] = useState(args.value)

    return (
      <div className="max-w-3xl rounded-2xl bg-(--t-bg-deep) p-6">
        <DiscussionWritingEditor
          {...args}
          value={value}
          onChange={(next) => {
            setValue(next)
            args.onChange(next)
          }}
        />
        <p id="writing-limit">{value.length} / 20,000</p>
      </div>
    )
  },
} satisfies Meta<typeof DiscussionWritingEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Dark: Story = { globals: { appearance: "dark" } }
export const ParagraphsAndHistory: Story = {
  args: { value: "First paragraph\n\nSecond paragraph" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const message = await canvas.findByRole("textbox", { name: "Message" })
    await expect(message).toHaveTextContent("Second paragraph")
    await userEvent.click(message)
    await userEvent.type(message, " Extra words")
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.stringContaining("\n\n")
    )
    await userEvent.click(canvas.getByRole("button", { name: "Undo" }))
    await expect(message).not.toHaveTextContent("Extra words")
    await userEvent.click(canvas.getByRole("button", { name: "Redo" }))
    await expect(message).toHaveTextContent("Extra words")
  },
}
export const CharacterLimit: Story = {
  args: { value: "x".repeat(20000) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const message = await canvas.findByRole("textbox", { name: "Message" })
    await userEvent.click(message)
    await userEvent.type(message, "z")
    await expect(message.textContent).toHaveLength(20000)
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}
