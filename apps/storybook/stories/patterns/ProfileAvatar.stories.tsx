import { ProfileAvatar } from "@/components/ds/ProfileAvatar"
import { COMMUNITY_TINTS } from "@/lib/design-tokens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Patterns/ProfileAvatar",
  component: ProfileAvatar,
  args: {
    initials: "MS",
    size: 40,
    palette: COMMUNITY_TINTS.violet,
    label: "Maya S.",
  },
} satisfies Meta<typeof ProfileAvatar>

export default meta
type Story = StoryObj<typeof meta>

export const Initials: Story = {}
export const Image: Story = {
  args: { src: "/library-placeholder.svg" },
  parameters: {
    docs: {
      description: {
        story:
          "A synthetic local image exercises sizing; no personal images are published.",
      },
    },
  },
}
export const Decorative: Story = {
  args: { label: undefined },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[aria-hidden=true]")).toBeTruthy()
  },
}
export const Empty: Story = {
  args: { initials: "" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("img", { name: "Maya S." })
    ).toHaveTextContent("?")
  },
}
export const Mint: Story = { args: { palette: COMMUNITY_TINTS.mint, size: 64 } }
