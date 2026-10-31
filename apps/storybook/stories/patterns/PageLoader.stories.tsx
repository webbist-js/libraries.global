import { PageLoader } from "@/components/global/PageLoader"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/PageLoader",
  component: PageLoader,
  args: { label: "Loading…" },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The real three-book brand mark assembles back to front, then reveals its square detail. Used inside pending page content; the application shell stays available. Loading is announced to screen readers without visible wording. No minimum loading time. Pauses outside the viewport or in a hidden tab; reduced motion shows the completed static logo.",
      },
    },
  },
} satisfies Meta<typeof PageLoader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
