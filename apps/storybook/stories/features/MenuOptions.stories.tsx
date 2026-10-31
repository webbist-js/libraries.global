import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { expect, within, waitFor } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Primitives/dropdown-menu/Options",
  args: { showHours: true },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="surface">Library display options</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Display</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={args.showHours}
                  onCheckedChange={(showHours) =>
                    updateArgs({ showHours: showHours === true })
                  }
                >
                  Show opening hours
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Share</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>
                      Email library details
                      <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem>Copy public link</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<{ showHours: boolean }>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ToggleHours: Story = {
  parameters: { docs: { story: { inline: false, height: "400px" } } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Library display options" })
    )
    const item = await within(document.body).findByRole("menuitemcheckbox", {
      name: "Show opening hours",
    })
    await userEvent.keyboard("{ArrowDown}")
    await waitFor(() => expect(item).toHaveFocus())
    await userEvent.keyboard("{Enter}")
    await waitFor(() => expect(item).not.toBeInTheDocument())
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Library display options" })
      ).toHaveFocus()
    )
  },
}
