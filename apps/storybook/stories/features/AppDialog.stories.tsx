import { AppDialog } from "@/components/elementary/AppDialog"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within, waitFor } from "storybook/test"

const meta = {
  title: "Patterns/App dialog",
  component: AppDialog,
  args: {
    Props: <Button variant="surface">Open confirmation</Button>,
    header: {
      title: "Review library details",
      description: "Check the example before continuing.",
    },
    children: <p>No saved record is changed by this example.</p>,
    confirmDialogClose: false,
  },
} satisfies Meta<typeof AppDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ConfirmBeforeClosing: Story = {
  args: { confirmDialogClose: true },
}
export const OpenAndClose: Story = {
  parameters: { docs: { story: { inline: false, height: "480px" } } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Open confirmation" })
    )
    const dialog = await within(document.body).findByRole("dialog", {
      name: "Review library details",
    })
    await waitFor(() => expect(dialog).toBeVisible())
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  },
}
