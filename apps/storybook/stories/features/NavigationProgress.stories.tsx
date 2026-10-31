import { NavigationProgress } from "@/components/global/NavigationProgress"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Patterns/Navigation progress",
  component: NavigationProgress,
  parameters: { docs: { story: { inline: false, height: "220px" } } },
  render: () => (
    <>
      <NavigationProgress />
      <a
        href="/storybook-pending-navigation"
        onClick={(event) => event.preventDefault()}
      >
        Preview navigation progress
      </a>
    </>
  ),
} satisfies Meta<typeof NavigationProgress>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Pending: Story = {
  play: async ({ canvas, userEvent, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("link", { name: "Preview navigation progress" })
    )
    await expect(
      canvasElement.ownerDocument.querySelector("[data-navigation-progress]")
    ).toBeVisible()
  },
}
