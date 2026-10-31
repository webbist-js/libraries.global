import { CardImageBlock } from "@/components/ds/CardImageBlock"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/CardImageBlock",
  component: CardImageBlock,
  args: {
    imageUrl: "/library-placeholder.svg",
    alt: "Illustration of a library",
    aspectRatio: "4/3",
    maxHeight: 240,
  },
} satisfies Meta<typeof CardImageBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Fallback: Story = { args: { imageUrl: null } }
