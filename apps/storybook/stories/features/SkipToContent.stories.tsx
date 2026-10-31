import { SkipToContent } from "@/components/global/SkipToContent"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Patterns/Skip to content",
  component: SkipToContent,
  args: { children: "Skip to main content" },
  parameters: { docs: { story: { inline: false, height: "280px" } } },
  render: (args) => (
    <>
      <SkipToContent {...args} />
      <main id="main" tabIndex={-1}>
        <h1 className="type-h1">Library details</h1>
        <p>Use the keyboard to reveal the skip link.</p>
      </main>
    </>
  ),
} satisfies Meta<typeof SkipToContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const KeyboardFocus: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    const link = canvas.getByRole("link", { name: "Skip to main content" })
    await expect(link).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(canvas.getByRole("main")).toHaveFocus()
  },
}
