import { HeaderDropdownContent } from "@/components/global/HeaderDropdown"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within, waitFor } from "storybook/test"

import { HeaderDropdownExample } from "../../fixtures/public/header-dropdown"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/HeaderDropdownContent",
  component: HeaderDropdownContent,
  args: { kind: "menu" },
  render: (args) => <HeaderDropdownExample kind={args.kind} openOnMount />,
  play: async ({ args }) => {
    const role =
      args.kind === "select"
        ? "listbox"
        : args.kind === "popover"
          ? "dialog"
          : "menu"
    const popup = await within(document.body).findByRole(role)
    await waitFor(() => expect(popup).toBeVisible())
    await waitFor(() =>
      expect(popup.contains(document.activeElement)).toBe(true)
    )
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    docs: {
      story: { inline: false, iframeHeight: 500 },
      description: {
        component:
          "Real dropdown, select and popover contexts preserve keyboard and focus behavior. Open Canvas for Controls.",
      },
    },
  },
} satisfies Meta<typeof HeaderDropdownContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Select: Story = { args: { kind: "select" } }
export const Popover: Story = { args: { kind: "popover" } }

export const KeyboardDismissal: Story = {
  play: async ({ canvas, userEvent }) => {
    const popup = await within(document.body).findByRole("menu")
    await waitFor(() => expect(popup).toBeVisible())
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(popup).not.toBeInTheDocument())
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Library actions" })
      ).toHaveFocus()
    )
  },
}
