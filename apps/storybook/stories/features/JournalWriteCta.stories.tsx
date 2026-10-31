import { JournalWriteCta } from "@/components/blog/JournalWriteCta"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Journal/Contribution",
  component: JournalWriteCta,
  render: function Example(args) {
    const id = useId()

    return <JournalWriteCta {...args} headingId={id} />
  },
  parameters: {
    docs: {
      description: {
        component:
          "The Journal landing page places this shared ActionCallout after From the Index and before Data drops. It offers story ideas and explains editorial review; the sidebar is reserved for the monthly dispatch.",
      },
    },
  },
} satisfies Meta<typeof JournalWriteCta>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: "Pitch a story" })
    ).toHaveAttribute("href", "/contribute/knowledge?type=journal")
    await expect(
      canvas.getByText(/an editor reviews every piece/)
    ).toBeVisible()
  },
}

export const NarrowFrench: Story = {
  globals: { locale: "fr" },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const panel = canvasElement.querySelector("section")!
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1)
  },
}

export const NarrowCzech: Story = {
  ...NarrowFrench,
  globals: { locale: "cs" },
}
