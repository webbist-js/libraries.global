import { Element } from "@/components/typography/element"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Foundations/Typography/Element",
  component: Element,
  args: {
    children: "Explore the collections",
    variant: "heading3",
    tag: "blockquote",
  },
} satisfies Meta<typeof Element>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
