import { ImageWithFallback } from "@/components/elementary/ImageWithFallback"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Media/Image with fallback",
  component: ImageWithFallback,
  args: {
    src: "/library-placeholder.svg",
    alt: "Synthetic library illustration",
    width: 480,
    height: 320,
  },
} satisfies Meta<typeof ImageWithFallback>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
