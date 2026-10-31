import { JournalSidebarFooter } from "@/components/articles/EditorialSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Journal/Monthly dispatch",
  component: JournalSidebarFooter,
  decorators: [
    (Story) => (
      <div style={{ width: 300, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The same compact newsletter footer is used on Journal landing and article pages, with an inline email field and Subscribe action. This idle preview does not send subscriptions.",
      },
    },
  },
} satisfies Meta<typeof JournalSidebarFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  globals: { locale: "en" },
  play: async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole("heading", { name: "The monthly dispatch" })
    ).toBeVisible()
    await expect(
      canvas.getByRole("textbox", { name: "Email address" })
    ).toHaveAttribute("type", "email")
    await expect(
      canvas.getByRole("button", { name: "Subscribe" })
    ).toBeVisible()
    const panel = canvasElement.querySelector("section")!
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1)
    const input = canvas
      .getByRole("textbox", { name: "Email address" })
      .getBoundingClientRect()
    const button = canvas
      .getByRole("button", { name: "Subscribe" })
      .getBoundingClientRect()
    await expect(
      Math.abs(input.top + input.height / 2 - button.top - button.height / 2)
    ).toBeLessThanOrEqual(2)
  },
}

export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const panel = canvasElement.querySelector("section")!
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1)
  },
}
