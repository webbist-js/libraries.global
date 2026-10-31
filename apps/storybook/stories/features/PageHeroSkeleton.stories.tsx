import { PageHeroSkeleton } from "@/components/ds/PageHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/PageHero/Loading",
  component: PageHeroSkeleton,
  args: {},
} satisfies Meta<typeof PageHeroSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
