import { TailwindIndicator } from "@/components/elementary/TailwindIndicator"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Developers/Breakpoint indicator",
  component: TailwindIndicator,
  parameters: {
    docs: {
      description: {
        component:
          "The actual development-only breakpoint marker. The production static build intentionally hides it.",
      },
    },
  },
} satisfies Meta<typeof TailwindIndicator>

export default meta
type Story = StoryObj<typeof meta>

export const Development: Story = {}
