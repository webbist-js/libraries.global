import { AppearanceControl } from "@/components/appearance/AppearanceControl"
import { AppearanceSettings } from "@/components/appearance/AppearanceSettings"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"
import { expect, userEvent, within, waitFor } from "storybook/test"

const meta = {
  title: "Patterns/Appearance",
  component: AppearanceSettings,
  parameters: { layout: "padded" },
  render: function Example(args) {
    const id = useId()

    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex justify-end">
          <AppearanceControl />
        </div>
        <AppearanceSettings {...args} id={id} />
      </div>
    )
  },
} satisfies Meta<typeof AppearanceSettings>

export default meta
type Story = StoryObj<typeof meta>

export const Settings: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("radiogroup", { name: "Appearance" })
    ).toBeVisible()
    await expect(canvas.getByRole("radio", { name: /^System/ })).toBeEnabled()
  },
}
export const HeaderMenu: Story = {
  render: () => <AppearanceControl />,
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByRole("button")
    await expect(trigger).toBeEnabled()
    await userEvent.click(trigger)
    const menu = within(canvasElement.ownerDocument.body)
    await waitFor(() =>
      expect(menu.getByRole("menuitemradio", { name: "Light" })).toBeVisible()
    )
    await expect(
      menu.getByRole("menuitemradio", { name: "Dark" })
    ).toBeVisible()
    await expect(
      menu.getByRole("menuitemradio", { name: /^System/ })
    ).toBeVisible()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}
export const FollowDevice: Story = {
  parameters: { docs: { story: { inline: false, height: "520px" } } },
  globals: { appearance: "system" },
  play: async ({ canvas, canvasElement }) => {
    const system = canvas.getByRole("radio", { name: /^System/ })
    await expect(system).toBeChecked()
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.documentElement.classList.contains("dark")
      ).toBe(window.matchMedia("(prefers-color-scheme: dark)").matches)
    )
  },
}
