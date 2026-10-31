import { HomepageFeatures } from "@/components/home/HomepageFeatures"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Home/HomepageFeatures",
  component: HomepageFeatures,
  args: {},
} satisfies Meta<typeof HomepageFeatures>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
