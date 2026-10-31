import { AuthTipCarousel } from "@/app/[locale]/auth/_components/AuthTipCarousel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthTipCarousel",
  component: AuthTipCarousel,
  args: {
    tips: [
      {
        title: "Find a library",
        body: "Browse libraries and reading rooms near you.",
      },
      {
        title: "Help keep details current",
        body: "Add a public source when suggesting a correction.",
      },
    ],
  },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof AuthTipCarousel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
