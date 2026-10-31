import { Drawer } from "@/components/ds/Drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn, expect, waitFor, within } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Patterns/Drawer",
  component: Drawer,
  argTypes: { children: { control: false }, title: { control: "text" } },
  args: {
    open: false,
    title: "Edit library details",
    titleId: "library-drawer-title",
    side: "right",
    size: "lg",
    onClose: fn(),
    children: (
      <label className="grid gap-2 p-5">
        Library name
        <Input defaultValue="Northbridge Library" />
      </label>
    ),
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <>
            <Button
              variant="surface"
              onClick={() => updateArgs({ open: true })}
            >
              Open editor
            </Button>
            <Drawer
              {...args}
              onClose={() => {
                args.onClose()
                updateArgs({ open: false })
              }}
            />
          </>
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof Drawer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Open: Story = {
  args: { open: true },
  parameters: { docs: { story: { inline: false, height: "600px" } } },
}
export const Workspace: Story = {
  parameters: { docs: { story: { inline: false, height: "600px" } } },
  args: { open: true, edgeAligned: true, size: "xl" },
}
export const Bottom: Story = { args: { side: "bottom" } }
export const Small: Story = { args: { size: "md" } }
export const OpenAndClose: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole("button", { name: "Open editor" })
    await userEvent.click(trigger)
    const dialog = await within(document.body).findByRole("dialog", {
      name: "Edit library details",
    })
    await waitFor(() => expect(dialog).toBeVisible())
    await expect(
      within(dialog).getByRole("textbox", { name: "Library name" })
    ).toHaveFocus()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
    await expect(args.onClose).toHaveBeenCalled()
  },
}
