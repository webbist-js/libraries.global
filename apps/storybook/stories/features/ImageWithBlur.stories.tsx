import { ImageWithBlur } from "@/components/elementary/ImageWithBlur"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Media/Image with blur",
  component: ImageWithBlur,
  args: {
    src: "/library-placeholder.svg",
    alt: "Synthetic library illustration",
    width: 480,
    height: 320,
  },
} satisfies Meta<typeof ImageWithBlur>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
